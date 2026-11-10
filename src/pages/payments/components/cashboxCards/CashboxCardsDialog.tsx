// dizayn-v2: superadmin-payments-main-cashbox-accounts
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  ArrowLeftRight,
  Banknote,
  Check,
  ChevronDown,
  CircleCheck,
  CreditCard,
  FileText,
  ImagePlus,
  Info,
  Pencil,
  Plus,
  Power,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { canManageCashboxCards, canManageShiftSettings } from "../../../../app/lib/access";
import {
  useCashboxCards,
  useMakeDefaultCashboxCard,
  useSetCashboxCardActive,
  type CashboxCard,
} from "../../../../entities/payments/cashboxCards";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  useConfirm,
} from "../../../../shared/ui/primitives";
import { cardSubtitle } from "../shiftCheck/aiStatusMeta";
import { useCashboxShift } from "../lib/useCashboxShift";
import { CardConvertDialog } from "./CardConvertDialog";
import { CardDeleteDialog } from "./CardDeleteDialog";
import { CardLedgerDialog } from "./CardLedgerDialog";
import { CardTransferDialog } from "./CardTransferDialog";
import { CashboxCardFormDialog } from "./CashboxCardFormDialog";
import { CashboxCardRowMenu, type CashboxCardMenuItem } from "./CashboxCardRowMenu";
import { cardErrorMessage } from "./cardMeta";
import { CardKindTile, CardNotice } from "./cardUi";

/**
 * «KARTALAR VA HISOB RAQAMLAR» OYNASI (cards1111; maket `superadmin-payments-main-cashbox-accounts`, BeePost
 * CardsManager). «Kassa balansi» dagi «Karta (Click)» qatori ochadi.
 *
 * Kim: superadmin/admin — asosiy kassa kartalari, to'liq boshqaruv (`canManageCashboxCards`); menejer — o'z filiali
 * kassasi (GET filialni JWT'dan oladi), faqat ko'rish: qoldiqlar va «Ko'chirma», yozish tugmalari yo'q.
 *
 * Tuzilish — USTMA-UST OYNALAR (`Dialog` qatlamlari): ro'yxat oynasi ochiq qoladi, forma / o'tkazma / konvertatsiya /
 * o'chirish / ko'chirma uning ustida ochiladi (orqadagi oyna `inert`, Esc faqat ustkisini yopadi, fokus ochgan
 * tugmaga qaytadi); tasdiq (`useConfirm`) uchinchi qatlam. Telefonda har biri pastki varaqa.
 *
 *  - Sarlavha ostida: «N ta faol · …»; asboblar: «Kartalararo o'tkazma», «Karta ↔ Naqd», «Karta qo'shish».
 *  - Qatorlar (har o'lchamda kartochka ro'yxati — oyna 640 px dan tor): turi ikonkasi, nom + «Asosiy» / «Arxivlangan»,
 *    qoldiq, «Bank · ··1234», «Turi · tizim · Egasi: …», Asosiy kartada «Karta tanlanmagan to'lovlar shu yerga tushadi»,
 *    smena belgilari (rasm, AI); amallar — «Ko'chirma» va menyu (Tahrirlash · Asosiy qilish · O'chirish; Asosiy kartada
 *    O'chirish o'chiq, sababi bilan). Arxivlanganlar — «Arxivlangan kartalar · N ta» ostida (Faollashtirish · O'chirish).
 *  - Moslik: «Kartalar yig'indisi X = kassadagi karta qoldig'i Y · Mos keladi» (`in_sync=false` — qizil ogohlantirish:
 *    ortiqchani nomli kartadan Asosiy kartaga kartalararo o'tkazma bilan o'tkazish; «Asosiy kartaga o'tkazish» tugmasi
 *    o'tkazma oynasini Asosiy karta manzil qilib ochadi).
 *
 * Ro'yxat faqat oyna ochilganda o'qiladi (`enabled: open`) — sahifa yuklanishida so'rov yo'q.
 */

type Sub<T> = { open: boolean; value: T | null; key: number };

const useSub = <T,>() => {
  const [state, setState] = useState<Sub<T>>({ open: false, value: null, key: 0 });
  return {
    state,
    show: (value: T) => setState((previous) => ({ open: true, value, key: previous.key + 1 })),
    hide: () => setState((previous) => ({ ...previous, open: false })),
  };
};

export type CashboxCardsDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Kassadagi naqd qoldiq («Karta ↔ Naqd» oynasidagi «Joriy naqd kassa»). */
  cashBalance: number;
};

export const CashboxCardsDialog = ({ open, onClose, cashBalance }: CashboxCardsDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const canManage = useSelector(canManageCashboxCards);
  const canManageShift = useSelector(canManageShiftSettings);
  const confirm = useConfirm();
  const query = useCashboxCards({ includeInactive: true, enabled: open });
  const shift = useCashboxShift({ enabled: open && canManage, resolveOpener: false });
  // Sahifadagi boshqa pul amallari kabi: smena yopiq bo'lsa pul ko'chirish qulf (backend ham rad etadi).
  const shiftLocked = shift.status === "closed";
  const makeDefault = useMakeDefaultCashboxCard();
  const setActive = useSetCashboxCardActive();
  const [showArchived, setShowArchived] = useState(false);

  const form = useSub<{ card: CashboxCard | null }>();
  const transfer = useSub<{ fromId: string | null; toId?: string | null }>();
  const convert = useSub<{ cardId: string | null }>();
  const remove = useSub<CashboxCard>();
  const ledger = useSub<CashboxCard>();

  const list = query.data;
  const cards = useMemo(() => list?.cards ?? [], [list]);
  const active = useMemo(() => cards.filter((card) => card.is_active), [cards]);
  const archived = useMemo(() => cards.filter((card) => !card.is_active), [cards]);
  const defaultCard = active.find((card) => card.is_default) ?? null;
  const cardNames = useMemo(() => new Map(cards.map((card) => [card.id, card.name])), [cards]);

  const handleMakeDefault = (card: CashboxCard) => {
    void confirm({
      tone: "primary",
      icon: CircleCheck,
      title: t("cashboxCards.makeDefault.title", { name: card.name }),
      description: defaultCard
        ? t("cashboxCards.makeDefault.descriptionPrevious", { previous: defaultCard.name })
        : t("cashboxCards.makeDefault.description"),
      confirmLabel: t("cashboxCards.makeDefault.confirm"),
      confirmIcon: CircleCheck,
      errorMessage: (error) => cardErrorMessage(error, t("cashboxCards.makeDefault.error")),
      onConfirm: () => makeDefault.mutateAsync(card.id),
    }).then((ok) => {
      if (ok) notify.success(t("cashboxCards.makeDefault.done"));
    });
  };

  const handleActivate = async (card: CashboxCard) => {
    try {
      await setActive.mutateAsync({ id: card.id, is_active: true });
      notify.success(t("cashboxCards.activate.done", { name: card.name }));
    } catch (error) {
      notify.error(cardErrorMessage(error, t("cashboxCards.activate.error")));
    }
  };

  const menuItems = (card: CashboxCard): CashboxCardMenuItem[] => {
    if (!card.is_active) {
      return [
        { key: "activate", label: t("cashboxCards.actions.activate"), icon: Power, onSelect: () => void handleActivate(card) },
        { key: "delete", label: t("cashboxCards.actions.delete"), icon: Trash2, onSelect: () => remove.show(card), danger: true },
      ];
    }
    const items: CashboxCardMenuItem[] = [
      { key: "edit", label: t("cashboxCards.actions.edit"), icon: Pencil, onSelect: () => form.show({ card }) },
    ];
    if (!card.is_default) {
      items.push({ key: "default", label: t("cashboxCards.actions.makeDefault"), icon: CircleCheck, onSelect: () => handleMakeDefault(card) });
    }
    items.push(
      card.is_default
        ? { key: "delete", label: t("cashboxCards.actions.delete"), icon: Trash2, hint: t("cashboxCards.actions.defaultNoDelete") }
        : { key: "delete", label: t("cashboxCards.actions.delete"), icon: Trash2, onSelect: () => remove.show(card), danger: true },
    );
    return items;
  };

  const renderCard = (card: CashboxCard) => {
    const subtitle = cardSubtitle(card);
    const meta = [
      card.kind ? t(`cashboxCards.kind.${card.kind}`) : null,
      card.card_network,
      card.holder_name ? t("cashboxCards.list.owner", { name: card.holder_name }) : null,
    ].filter(Boolean);
    return (
      <li key={card.id} className="flex gap-3 border-t border-border py-3.5 first:border-t-0">
        <CardKindTile kind={card.kind} className={cx(!card.is_active && "opacity-60")} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="break-words text-sm font-semibold text-text">{card.name}</span>
                {/* Maketda `el-tone-neutral` — turi belgisi, holat emas. */}
                {card.is_default ? <Badge>{t("cashboxCards.list.defaultBadge")}</Badge> : null}
                {card.is_active ? null : <Badge>{t("cashboxCards.list.archivedBadge")}</Badge>}
              </span>
              {subtitle ? <span className="text-[13px] text-text-muted">{subtitle}</span> : null}
            </div>
            <span
              className={cx(
                "whitespace-nowrap text-sm font-semibold",
                card.balance < 0 ? "text-danger-fg" : "text-text",
              )}
            >
              <span className="sr-only">{t("cashboxCards.list.balance")}: </span>
              {money(card.balance)}
            </span>
          </div>
          {meta.length > 0 ? <span className="text-xs text-text-muted">{meta.join(" · ")}</span> : null}
          {card.is_default ? <span className="text-xs text-text-muted">{t("cashboxCards.list.defaultHint")}</span> : null}
          {card.require_photo_on_shift_close || card.ai_check_enabled ? (
            <span className="flex flex-wrap gap-1.5 pt-0.5">
              {card.require_photo_on_shift_close ? (
                <Badge size="sm" icon={ImagePlus}>
                  {t("cashboxCards.list.photoRequired")}
                </Badge>
              ) : null}
              {card.ai_check_enabled ? (
                <Badge size="sm" icon={Sparkles}>
                  {t("cashboxCards.list.aiCheck")}
                </Badge>
              ) : null}
            </span>
          ) : null}
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={FileText}
              onClick={() => ledger.show(card)}
              aria-label={t("cashboxCards.actions.ledgerFor", { name: card.name })}
            >
              {t("cashboxCards.actions.ledger")}
            </Button>
            {canManage ? (
              <CashboxCardRowMenu label={t("cashboxCards.actions.menu", { name: card.name })} items={menuItems(card)} />
            ) : null}
          </div>
        </div>
      </li>
    );
  };

  let content;
  if (query.isLoading) {
    content = <SkeletonList rows={3} />;
  } else if (query.isError && !list) {
    content = (
      <ErrorState
        error={query.error}
        title={t("cashboxCards.list.error")}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (!list || cards.length === 0) {
    content = <EmptyState icon={CreditCard} title={t("cashboxCards.list.empty")} description={canManage ? t("cashboxCards.list.emptyHint") : undefined} />;
  } else {
    content = (
      <>
        <ul aria-label={t("cashboxCards.list.label")} className="m-0 flex list-none flex-col p-0">
          {active.map(renderCard)}
        </ul>

        <div
          className={cx(
            "flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl px-3.5 py-3 text-[13px]",
            list.in_sync ? "bg-sunken text-text-muted" : "bg-danger-soft text-danger-fg",
          )}
        >
          {list.in_sync ? (
            <CircleCheck aria-hidden="true" size={16} className="shrink-0 text-success-fg" />
          ) : (
            <TriangleAlert aria-hidden="true" size={16} className="shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            {t("cashboxCards.list.sum", { total: money(list.total_card), cashbox: money(list.balance_card) })}
          </span>
          {list.in_sync ? (
            <Badge tone="success" icon={Check}>
              {t("cashboxCards.list.inSync")}
            </Badge>
          ) : (
            <Badge tone="danger" icon={TriangleAlert}>
              {t("cashboxCards.list.outOfSync")}
            </Badge>
          )}
          {list.in_sync ? null : (
            // Tuzatish — nomli kartadan Asosiy kartaga kartalararo o'tkazma (backend ham shuni aytadi). «Karta ↔ Naqd»
            // tuzatmaydi: nomli kartadan naqdga chiqim `balance_card` ni ham, karta qoldig'ini ham bir xil kamaytiradi.
            <span className="basis-full">{t("cashboxCards.list.outOfSyncHint", { amount: money(list.default_balance) })}</span>
          )}
          {!list.in_sync && canManage && defaultCard ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={ArrowLeftRight}
              onClick={() => transfer.show({ fromId: null, toId: defaultCard.id })}
              className="max-md:w-full"
            >
              {t("cashboxCards.list.fixSync")}
            </Button>
          ) : null}
        </div>

        {archived.length > 0 ? (
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="sm"
              rightIcon={
                <ChevronDown
                  aria-hidden="true"
                  size={16}
                  className={cx("transition-transform duration-150 motion-reduce:transition-none", showArchived && "rotate-180")}
                />
              }
              aria-expanded={showArchived}
              onClick={() => setShowArchived((previous) => !previous)}
              className="self-start"
            >
              {t("cashboxCards.list.archived", { count: archived.length })}
            </Button>
            {showArchived ? (
              <ul aria-label={t("cashboxCards.list.archivedLabel")} className="m-0 flex list-none flex-col p-0">
                {archived.map(renderCard)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="xl"
        icon={CreditCard}
        title={t("cashboxCards.title")}
        description={list ? t("cashboxCards.subtitle", { count: active.length }) : undefined}
      >
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 max-md:grid max-md:grid-cols-1">
            <Button
              variant="ghost"
              leftIcon={ArrowLeftRight}
              disabled={!list}
              onClick={() => transfer.show({ fromId: null })}
            >
              {t("cashboxCards.actions.transfer")}
            </Button>
            <Button
              variant="ghost"
              leftIcon={Banknote}
              disabled={!list}
              onClick={() => convert.show({ cardId: null })}
            >
              {t("cashboxCards.actions.convert")}
            </Button>
            <Button
              variant="secondary"
              leftIcon={Plus}
              disabled={!list}
              onClick={() => form.show({ card: null })}
              className="md:ml-auto"
            >
              {t("cashboxCards.actions.add")}
            </Button>
          </div>
        ) : (
          <CardNotice tone="neutral" icon={Info}>
            {t("cashboxCards.readOnly")}
          </CardNotice>
        )}
        {content}
      </Dialog>

      {form.state.value ? (
        <CashboxCardFormDialog
          key={form.state.key}
          open={form.state.open}
          onClose={form.hide}
          card={form.state.value.card}
          defaultCard={defaultCard}
          canManageShift={canManageShift}
        />
      ) : null}
      {transfer.state.value ? (
        <CardTransferDialog
          key={transfer.state.key}
          open={transfer.state.open}
          onClose={transfer.hide}
          cards={active}
          initialFromId={transfer.state.value.fromId}
          initialToId={transfer.state.value.toId ?? null}
          shiftLocked={shiftLocked}
        />
      ) : null}
      {convert.state.value ? (
        <CardConvertDialog
          key={convert.state.key}
          open={convert.state.open}
          onClose={convert.hide}
          cards={active}
          cashBalance={cashBalance}
          initialCardId={convert.state.value.cardId}
          shiftLocked={shiftLocked}
        />
      ) : null}
      {remove.state.value ? (
        <CardDeleteDialog
          key={remove.state.key}
          open={remove.state.open}
          onClose={remove.hide}
          card={remove.state.value}
          cards={active}
          shiftLocked={shiftLocked}
        />
      ) : null}
      {ledger.state.value ? (
        <CardLedgerDialog
          key={ledger.state.key}
          open={ledger.state.open}
          onClose={ledger.hide}
          card={ledger.state.value}
          cardNames={cardNames}
        />
      ) : null}
    </>
  );
};

export default CashboxCardsDialog;
