// dizayn-v2: superadmin-neworders-create-ai-input, superadmin-neworders-create-ai-preview, admin-neworders-create-ai, manager-new-orders-create-ai, registrator-new-orders-create-ai, market-new-orders-create-ai-input, market-new-orders-create-ai-preview, market_operator-new-orders-create-manual
import { memo, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import {
  buildAiConfirmPayload,
  useAiConfirm,
  type AiPreviewOrder,
} from "../../../../../entities/ai-order";
import { useLogistics } from "../../../../../entities/logistics/api/logisticsApi";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../../../entities/product";
import type { MarketOption } from "../../model/orderCreateForm";
import { CreateAlert } from "../CreateAlert";
import Step1Market from "../Step1Market";
import AiConfirmBar from "./AiConfirmBar";
import AiCreatedList from "./AiCreatedList";
import AiInputPanel from "./AiInputPanel";
import AiPreviewCard, { type AiAreaItem, type AiProductOption } from "./AiPreviewCard";
import { confirmFailureText, confirmHttpErrorText } from "./aiErrorText";
import { toCreatedRow, toDraft, toList, type AiCreatedRow, type AiDraft } from "./aiDraft";
import { evalPreview } from "./evalPreview";
import { previewSig } from "./previewSig";
import { useKeepFocusedFieldVisible } from "./useKeepFocusedFieldVisible";
import { Card, useConfirm } from "../../../../../shared/ui/primitives";

/** Katalog to'liq — qo'lda formadagi `Step2Combined` bilan bir xil parametr (bitta so'rov kaliti). */
const AI_CATALOG_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

type AiCreatePanelProps = {
  /** Tab faolmi (yashirin turganda ham holat saqlanadi). */
  active: boolean;
  /** Market tomoni (market va market operatori): market serverda tokendan, katalog — `my-products`. */
  isMarketRole: boolean;
  market: MarketOption | null;
  /** «Qo'lda» rejimiga o'tish. Berilmasa (market operatori, MO-3 — qo'lda yaratish MO-7 da) xato tugmasi yo'q. */
  onSwitchToManual?: () => void;
  /**
   * Viloyat/tuman ro'yxatlari bormi (sukut `true`). Market operatorida `false` — `GET /region` unga 403 (N11):
   * ro'yxatlar so'ralmaydi, viloyat shart emas (`ai-confirm` uni tumandan oladi).
   */
  areaLists?: boolean;
  /** Admin/registrator: marketni qayta tanlash (`no_market`). Market rolida berilmaydi. */
  onChangeMarket?: () => void;
};

/**
 * "AI BILAN" REJIMI — kirish paneli, natija xabari, «Yaratildi» ro'yxati, preview kartalari va pastga
 * yopishgan tasdiqlash paneli (maketlar `*-create-ai-input`, `*-create-ai-preview`). Sahifaning asosiy
 * ustunida turadi (sarlavha va yon ustun — `index.tsx`).
 *
 * Market tanlash BITTA joyda: sahifaning umumiy formasidagi `market` o'qiladi
 * (localStorage emas). Admin/registrator uchun market tanlanmagan bo'lsa
 * avval ko'rsatma va market tanlash maydoni ko'rsatiladi (maket «Market tanlanmagan»).
 */
const AiCreatePanel = ({
  active,
  isMarketRole,
  market,
  onSwitchToManual,
  onChangeMarket,
  areaLists = true,
}: AiCreatePanelProps) => {
  const { t } = useTranslation("orders");
  const queryClient = useQueryClient();
  const confirm = useAiConfirm();

  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [created, setCreated] = useState<AiCreatedRow[]>([]);
  const [parseNotice, setParseNotice] = useState("");
  const [resultSummary, setResultSummary] = useState<{ created: number; failed: number } | null>(null);
  const [confirmError, setConfirmError] = useState("");
  /** Yaratilgan buyurtmalar imzosi — qayta tahlilda ikkinchi marta chiqmasin. */
  const createdSigs = useRef(new Set<string>());
  const submittingRef = useRef(false);
  const nextKey = useRef(0);
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLElement | null>(null);

  const hasMarket = isMarketRole || Boolean(market);
  const marketId = !isMarketRole && market ? String(market.id) : undefined;

  const { useGetByMarketId, useGetMyProducts } = useProducts();
  // Katalog to'liq (500 gacha) — `limit` siz server 10 tasini berardi va tanlov ro'yxati kesilardi (D-20).
  // Kalit qo'lda formadagi katalog bilan bir xil — so'rov bitta.
  const marketProducts = useGetByMarketId(marketId, !isMarketRole && drafts.length > 0, AI_CATALOG_PARAMS);
  const myProducts = useGetMyProducts(isMarketRole && drafts.length > 0, AI_CATALOG_PARAMS);
  const productsQuery = isMarketRole ? myProducts : marketProducts;
  const products: AiProductOption[] = toList<{ id: string | number; name?: string }>(productsQuery.data).map(
    (product) => ({ id: String(product.id), name: product.name ?? `#${product.id}` }),
  );

  const { useGetRegions } = useLogistics();
  const regionsQuery = useGetRegions(areaLists);
  const regions = toList<AiAreaItem>(regionsQuery.data);

  const navigate = useNavigate();
  const confirmLeave = useConfirm();

  // «Mavjud (#N)» kartasi (`duplicate_recent`) na tayyorlar, na to'ldirilmaganlar qatorida — u yuborilmaydi.
  const pendingDrafts = drafts.filter((draft) => !draft.existingOrderId);
  const previewRules = { regionRequired: areaLists };
  const readyDrafts = pendingDrafts.filter((draft) => evalPreview(draft.order, previewRules).ready);
  const hasUnconfirmedReady = readyDrafts.length > 0;

  useKeepFocusedFieldVisible(cardsRef, barRef, active && drafts.length > 0);

  /**
   * Sahifadan chiqish himoyasi. ⚠️ Ilova `BrowserRouter` da ishlaydi —
   * react-router `useBlocker` faqat data router bilan ishlaydi. Shu sabab:
   * brauzer yopilishi/yangilanishi uchun `beforeunload`, ilova ichidagi
   * havolalar (menyu) uchun esa bosishni ushlab tasdiq so'raladi.
   */
  useEffect(() => {
    if (!hasUnconfirmedReady) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      // Tasdiq oynasi asinxron: o'tish to'xtatiladi, «Chiqish» bosilsa — o'sha manzilga o'tiladi.
      event.preventDefault();
      event.stopPropagation();
      const to = `${anchor.pathname}${anchor.search}${anchor.hash}`;
      void confirmLeave({
        tone: "danger",
        title: t("aiLeaveTitle"),
        description: t("aiLeaveText"),
        confirmLabel: t("aiLeaveAction"),
        cancelLabel: t("aiLeaveStay"),
        icon: LogOut,
        confirmIcon: LogOut,
      }).then((ok) => {
        if (ok) navigate(to);
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [confirmLeave, hasUnconfirmedReady, navigate, t]);

  const handleParsed = (orders: AiPreviewOrder[], draftId?: string) => {
    setResultSummary(null);
    setConfirmError("");
    // O'rin filtrdan OLDIN olinadi: `ai_item_index` — tahlil javobidagi asl o'rin (vncdmXOy).
    const fresh = orders
      .map((order, position) => ({ order, position }))
      .filter(({ order }) => !createdSigs.current.has(previewSig(order)));
    const skipped = orders.length - fresh.length;
    setDrafts(
      fresh.map(({ order, position }) => {
        nextKey.current += 1;
        return toDraft(order, `draft-${nextKey.current}`, draftId, position);
      }),
    );
    setParseNotice(
      orders.length === 0 ? t("aiNoOrdersFound") : skipped > 0 ? t("aiSkippedCreated", { count: skipped }) : "",
    );
  };

  const updateDraft = (key: string, order: AiDraft["order"]) =>
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.key === key ? { ...draft, order, createError: undefined, existingOrderId: undefined } : draft,
      ),
    );

  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((draft) => draft.key !== key));

  /**
   * Faqat `ready` kartalar yuboriladi. Javob `results[].index` orqali
   * yuborilgan ro'yxatdagi kartaga bog'lanadi: yaratilganlari "Yaratildi"
   * ro'yxatiga o'tadi, yiqilganlari xato matni bilan kartada qoladi.
   *
   * ⚠️ Timeout / javobsiz holatda QAYTA YUBORILMAYDI — natija noma'lum,
   * ko'r-ko'rona qayta yuborish dublikat buyurtma demakdir.
   */
  const submit = (targets: AiDraft[]) => {
    const readyTargets = targets.filter((draft) => !draft.existingOrderId && evalPreview(draft.order, previewRules).ready);
    if (submittingRef.current || confirm.isPending || readyTargets.length === 0) return;
    submittingRef.current = true;
    setConfirmError("");
    setResultSummary(null);

    const payload = {
      ...buildAiConfirmPayload(
        readyTargets.map((draft) => draft.order),
        { marketId, includeMarketId: !isMarketRole },
      ),
      request_id: crypto.randomUUID(),
    };

    confirm.mutate(payload, {
      onSuccess: (response) => {
        const createdIds = new Map<string, string | undefined>();
        const failed = new Map<string, string>();
        const existing = new Map<string, string>();
        for (const result of response?.results ?? []) {
          const draft = readyTargets[result.index];
          if (!draft) continue;
          if (result.ok) createdIds.set(draft.key, result.order_id);
          else failed.set(draft.key, confirmFailureText(result, t));
          if (!result.ok && result.code === "duplicate_recent" && result.order_id) existing.set(draft.key, result.order_id);
        }

        const createdDrafts = readyTargets.filter((draft) => createdIds.has(draft.key));
        createdDrafts.forEach((draft) => createdSigs.current.add(previewSig(draft.order)));
        setCreated((prev) => [...createdDrafts.map((draft) => toCreatedRow(draft, createdIds.get(draft.key))), ...prev]);
        setDrafts((prev) =>
          prev
            .filter((draft) => !createdIds.has(draft.key))
            .map((draft) =>
              failed.has(draft.key)
                ? { ...draft, createError: failed.get(draft.key), existingOrderId: existing.get(draft.key) }
                : draft,
            ),
        );
        setResultSummary({ created: createdDrafts.length, failed: failed.size });
      },
      onError: (error) => {
        const status = (error as AxiosError).response?.status;
        // Natija noma'lum — ro'yxat yangilanadi, operator o'sha yerdan tekshiradi.
        if (!status || status >= 500) void queryClient.invalidateQueries({ queryKey: ["orders"] });
        setConfirmError(confirmHttpErrorText(error, t));
      },
      onSettled: () => {
        submittingRef.current = false;
      },
    });
  };

  /**
   * "To'ldirilmagan (N)": ekran markazidan PASTDAGI birinchi tayyor bo'lmagan
   * kartaga o'tadi; pastda qolmagan bo'lsa birinchisiga qaytadi (aylana).
   * Skroll `<main>` da — `scrollIntoView` shunga ham ishlaydi.
   * ⚠️ `block: "start"`, "center" EMAS: ochiq karta telefonda ekrandan baland,
   * markazlashda uning boshi (holat va kamchiliklar ro'yxati) ekrandan chiqib ketadi.
   */
  const jumpToUnready = () => {
    const cards = Array.from(
      cardsRef.current?.querySelectorAll<HTMLElement>('[data-testid="ai-preview-card"][data-ready="false"]') ?? [],
    );
    if (cards.length === 0) return;
    const middle = window.innerHeight / 2;
    const next = cards.find((card) => card.getBoundingClientRect().top > middle) ?? cards[0];
    next.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!hasMarket) {
    return active ? (
      <Card bodyClassName="flex flex-col gap-3">
        <CreateAlert tone="info">{t("aiSelectMarketFirst")}</CreateAlert>
        <Step1Market compact />
      </Card>
    ) : null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AiInputPanel
        marketId={marketId}
        onParsed={handleParsed}
        onSwitchToManual={onSwitchToManual}
        onSelectMarket={isMarketRole ? undefined : onChangeMarket}
      />

      {parseNotice ? <CreateAlert tone="info">{parseNotice}</CreateAlert> : null}
      {resultSummary ? (
        <CreateAlert
          tone={resultSummary.failed > 0 ? "warning" : "success"}
          title={t("aiResultSummary", resultSummary)}
        />
      ) : null}
      {confirmError ? <CreateAlert tone="danger">{confirmError}</CreateAlert> : null}

      <AiCreatedList rows={created} />

      {drafts.length > 0 ? (
        <div ref={cardsRef} className="flex min-w-0 flex-col gap-4">
          {drafts.map((draft, index) => (
            <AiPreviewCard
              key={draft.key}
              draft={draft}
              index={index}
              products={products}
              productsLoading={productsQuery.isLoading}
              regions={regions}
              regionsLoading={areaLists && regionsQuery.isLoading}
              areaLists={areaLists}
              creating={confirm.isPending}
              onChange={(order) => updateDraft(draft.key, order)}
              onRemove={() => removeDraft(draft.key)}
              onCreate={() => submit([draft])}
            />
          ))}
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <AiConfirmBar
          readyOrders={readyDrafts.map((draft) => draft.order)}
          notReadyCount={pendingDrafts.length - readyDrafts.length}
          pending={confirm.isPending}
          onConfirm={() => submit(readyDrafts)}
          onJumpToUnready={jumpToUnready}
          barRef={barRef}
        />
      ) : null}
    </div>
  );
};

export default memo(AiCreatePanel);
