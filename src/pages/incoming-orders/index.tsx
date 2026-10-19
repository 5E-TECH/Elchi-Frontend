// dizayn-v2: superadmin-neworders-incoming-scan, admin-neworders-incoming-scan, manager-new-orders-incoming-scan
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Check, Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import type { RootState } from "../../app/config/store";
import { extractScannerToken } from "../../shared/lib/scanToken";
// `shared/components/ScanFeedbackOverlay` ham aynan shu joydan import qiladi —
// ovozli/vizual qaytarma app darajasida mount qilingan, shu bois bu sahifadan
// ham ishlaydi.
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import { useScanTarget, type ScanTargetListItem } from "../../shared/lib/scanner/scanTargets";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { cx } from "../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import {
  fetchExternalBatchScan,
  sourceLabel,
  useIncomingExternalOrders,
  useIncomingSources,
  useReceiveByScan,
  type IncomingOrder,
} from "../../entities/incoming-orders";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  TONE_SOFT,
} from "../../shared/ui/primitives";
import { districtName, orderLabel } from "./lib";
import IncomingTable from "./ui/IncomingTable";
import ScanInput from "./ui/ScanInput";
import { ScanMessage, type ScanMessageData } from "./ui/ScanMessage";

/**
 * Bu ekranga kimlar kira oladi — backend guardi bilan BIR XIL bo'lishi shart.
 *
 * `manager` 2026-09-10 da qo'shildi: hamkordan (BeePost) kelgan posilkalar HQ
 * da qabul qilinadi va buni HQ menejeri bajaradi.
 *
 * ⚠️ ROL O'ZI YETARLI EMAS. Backend menejer va registratorni O'Z FILIALI bilan
 * cheklaydi (`resolveReceiveBranchScope`): begona filial buyurtmasi bo'lsa
 * butun so'rov rad etiladi, filiali yo'q xodim esa hech nima qabul qila
 * olmaydi. Bu yerdagi ro'yxat faqat ekranni ko'rsatadi — haqiqiy chegara
 * serverda.
 */
const ALLOWED_ROLES = new Set([
  "superadmin",
  "admin",
  "registrator",
  "manager",
]);

/** `.el-overline` · `.el-stat-value` · `.el-stat-unit` (CODE-MAP 0.2, 2.4). */
const OVERLINE = "text-xs font-semibold uppercase tracking-[.05em] text-text-muted";
const STAT_VALUE = "m-0 whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text";
const STAT_UNIT = "ml-1 text-sm font-semibold tracking-normal text-text-muted";

/** Muvaffaqiyatli skan xabarining kulrang davomi: «Rustam Jo'rayev, Olmazor tumani». */
const orderDetail = (order: IncomingOrder) =>
  [order.customer?.name, districtName(order)].filter((part) => part && part !== "—").join(", ") || undefined;

/**
 * HAMKORDAN KELGAN BUYURTMALARNI SKANERLAB QABUL QILISH (HQ).
 *
 * Nima uchun kerak: tashqi tizim Partner API orqali posilka yaratganda
 * buyurtma bizda `new` holatida paydo bo'ladi, lekin JISMONAN hali yetib
 * kelmagan. Operator posilkalarni qo'lida ushlab QR'ini skanerlaydi — shunda
 * tizimdagi yozuv bilan haqiqiy posilka mos kelishi TASDIQLANADI va faqat
 * skanerlangan buyurtmalar qabul qilinadi.
 *
 * ⚠️ EKRAN BITTA MANBAGA BOG'LANGAN (`:marketId`). Ilgari u BARCHA tashqi
 * buyurtmani aralash ko'rsatardi: operator qo'lida bir manbaning qopi turib,
 * ro'yxatda boshqasining posilkasini ham ko'rardi va "topilmadi" xabari
 * nimani bildirishi tushunarsiz bo'lardi. Manba `/new-orders/incoming`
 * sahifasida tanlanadi.
 *
 * DIZAYN QARORI — skan har safar serverga so'rov YUBORMAYDI. Ro'yxat bir marta
 * yuklanadi va skanerlangan token ro'yxatdagi `qr_code_token` bilan solishtiriladi.
 * Sabab: (a) skaner tez ishlaydi, har skanda so'rov kutish operatorni sekinlashtiradi;
 * (b) bu ro'yxatda YO'Q posilkani tasodifan qabul qilishning oldini oladi.
 *
 * KO'RINISH (dizayn v2, maket `superadmin-neworders-incoming-scan`): o'z sarlavhasi
 * («← Kiruvchi posilkalar» · manba nomi, qobiq tablarisiz), «Skanerlash» kartasi (USB skaner
 * maydoni, «Kelgan» / «Skanerlangan», chiziq, oxirgi skan natijasi) va «Kelgan posilkalar»
 * jadvali. «Qabul qilish» har kenglikda yagona asosiy tugma, telefonda ham skaner maydoni ko'rinadi.
 *
 * KAMERA (Trello v1eLN2tV 2-bosqich; maketlar `superadmin-neworders-incoming-scan-camera`,
 * `manager-new-orders-incoming-scan-camera`): sahifada kamera tugmasi yo'q — markaziy «Skaner» tugmasi
 * (desktopda «Skanerlash») shu sahifaning maqsadini ochadi. Kamera o'qigan kod `ScanInput` dagi AYNAN
 * `handleScan` ga tushadi (faqat belgilaydi, qabul — sahifadagi «Qabul qilish»). Kamera ichida manba
 * almashtiriladi (`/new-orders/incoming/:id`, kamera ochiq qoladi); qop to'liq emas bo'lsa — ogohlantirish.
 */
const IncomingOrdersPage = () => {
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const { marketId } = useParams<{ marketId: string }>();
  const role = useSelector((state: RootState) => state.role.role);
  const allowed = Boolean(role && ALLOWED_ROLES.has(role));

  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * ⚠️ ID VA TOKEN IKKISI HAM SAQLANADI.
   *
   * `scannedIds` — faqat EKRAN uchun (qaysi qator belgilandi).
   * `scannedTokens` — SERVERGA yuboriladi.
   *
   * Ilgari serverga `order_ids` ketardi, ya'ni skanerlash dalili faqat
   * frontendda edi va darvozani chetlab o'tish mumkin bo'lardi (audit K2).
   * Endi token serverga boradi va u o'zi buyurtmaga moslaydi.
   */
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [scannedTokens, setScannedTokens] = useState<string[]>([]);
  const [message, setMessage] = useState<ScanMessageData | null>(null);
  /**
   * Oxirgi qop skani: qop a'zolari va qopdagi jami posilka. «Qopda yetishmaydi N» shundan har renderda hisoblanadi —
   * kamerada qopdagi posilka «Bekor qilish» bilan olinsa ham son to'g'ri qoladi.
   */
  const [lastBag, setLastBag] = useState<{ memberIds: string[]; total: number } | null>(null);
  const bagShortage = lastBag
    ? Math.max(0, lastBag.total - lastBag.memberIds.filter((id) => scannedIds.has(id)).length)
    : 0;

  /**
   * ⚠️ `market_id` — manba filtri. Hamkor posilka yaratganda `elchi_market_id`
   * MAJBURIY, ya'ni Elchi modelida kiruvchi buyurtma aynan shu marketning
   * buyurtmasi bo'ladi. Buyurtma yozuvida "qaysi tashqi tizimdan keldi"
   * degan alohida maydon yo'q, shu bois guruhlash kaliti ham shu.
   */
  const query = useIncomingExternalOrders({
    status: "new",
    market_id: marketId,
  });

  // Sarlavhada manba nomi ko'rinishi kerak — operator qaysi qopni
  // skanerlayotganini ekrandan tasdiqlab olsin.
  const sources = useIncomingSources();
  const source = (sources.data ?? []).find((s) => s.market_id === marketId);
  const receiveByScan = useReceiveByScan();

  const orders = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? orders.length;
  // So'rov yiqilganda bo'sh massiv "posilka kelmagan" bilan bir xil ko'rinib
  // qolmasligi kerak — buzuq tizim va bo'sh ro'yxat alohida ko'rsatiladi.
  const listFailed = query.isError && orders.length === 0;
  const listStale = query.isError && orders.length > 0;
  // Raqamlar faqat ro'yxat bor bo'lsa: yuklanish va xato paytida «0» yolg'on bo'lardi — «—».
  const listReady = !query.isLoading && !listFailed;
  // Server javob bergan bo'lsa uning sababi ko'rsatiladi; tarmoq xatosi yoki
  // timeout'da esa axios'ning inglizcha "Network Error" matni o'rniga
  // tushunarli xabar (`ErrorState` turi bo'yicha).
  const hasServerResponse = Boolean((query.error as { response?: unknown } | null)?.response);
  const listErrorReason = hasServerResponse ? getBackendErrorMessage(query.error) : undefined;

  /**
   * Qop (batch) tokeni → shu qopdagi KUTAYOTGAN posilkalar. Ro'yxat faqat
   * `new` holatidagilar, ya'ni oldin bittalab qabul qilinganlar bu yerda yo'q:
   * qop skani faqat qolganlarini belgilaydi, javobgarlik yozuvi ikkilanmaydi.
   */
  const byBatch = useMemo(() => {
    const map = new Map<string, IncomingOrder[]>();
    for (const order of orders) {
      const token = String(order.external_batch_token ?? "").trim();
      if (!token) continue;
      map.set(token, [...(map.get(token) ?? []), order]);
    }
    return map;
  }, [orders]);

  /** Skanerlangan token → buyurtma. Har skanda qayta qurilmaydi. */
  const byToken = useMemo(() => {
    const map = new Map<string, IncomingOrder>();
    for (const order of orders) {
      const token = String(order.qr_code_token ?? "").trim();
      if (token) map.set(token, order);
    }
    return map;
  }, [orders]);

  // Skaner klaviatura sifatida ishlaydi — maydon doim fokusda turishi kerak.
  useEffect(() => {
    if (allowed) inputRef.current?.focus();
  }, [allowed]);

  // Ro'yxat yangilanganda skanerlanganlar tozalanadi (qabul qilingandan keyin
  // eski belgilar qolib, operatorni chalg'itmasin). Effekt emas — render paytida
  // (React tavsiyasi): eski belgilar bir kadr ham yangi ro'yxat ustida turmaydi.
  const [listVersion, setListVersion] = useState(query.dataUpdatedAt);
  if (listVersion !== query.dataUpdatedAt) {
    setListVersion(query.dataUpdatedAt);
    setScannedIds(new Set());
    setScannedTokens([]);
    setLastBag(null);
  }

  /**
   * QOP SKANI: qopdagi hali belgilanmagan posilkalar belgilanadi. Serverga har
   * birining O'Z tokeni ketadi (bittalab skan bilan ayni yo'l) — qop tokeni
   * esa faqat ularni topish uchun. Hisob: "Qop: N posilkadan M tasi".
   */
  const markBatch = (members: IncomingOrder[], size: number | null) => {
    const fresh = members.filter((order) => !scannedIds.has(order.id) && String(order.qr_code_token ?? "").trim());
    const total = Math.max(size ?? 0, members.length);
    if (!fresh.length) {
      const text = t("incomingBatchAlready", { size: total, count: members.length });
      void playScanFeedback("error", text);
      setMessage({ tone: "warn", text });
      return;
    }
    setScannedIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((order) => next.add(order.id));
      return next;
    });
    setScannedTokens((prev) => [...prev, ...fresh.map((order) => String(order.qr_code_token).trim())]);
    const marked = members.filter((order) => scannedIds.has(order.id)).length + fresh.length;
    const text = t("incomingBatchMarked", { size: total, count: marked });
    void playScanFeedback("success", text);
    setLastBag({ memberIds: members.map((order) => order.id), total });
    setMessage({
      tone: marked < total ? "warn" : "success",
      text,
    });
  };

  /**
   * Ro'yxatda na posilka, na qop topilmadi — server qop tokenini biladimi?
   * (`GET /scan/:token` qop qidiruvi.) Faqat moslik bo'lmaganda so'raladi:
   * oddiy skan avvalgidek serverga bormaydi.
   */
  const resolveRemoteBatch = async (token: string) => {
    const batch = await fetchExternalBatchScan(token).catch(() => null);
    const members = batch
      ? orders.filter((order) =>
          batch.members.some(
            (member) =>
              (member.id && member.id === order.id) ||
              (member.token && member.token === String(order.qr_code_token ?? "").trim()),
          ),
        )
      : [];
    if (!batch || !members.length) {
      void playScanFeedback("missing", t("incoming.cameraNotInList"));
      setMessage({ tone: "error", text: t("incomingScanNotFound") });
      return;
    }
    markBatch(members, batch.size ?? members.length);
  };

  const handleScan = (raw: string) => {
    const token = extractScannerToken(raw) ?? raw.trim();
    if (!token) return;

    // Ro'yxat yuklanmagan bo'lsa "ro'yxatda yo'q" deyish yolg'on bo'lardi —
    // posilkani hali hech narsa bilan solishtirib bo'lmaydi.
    if (query.isLoading || listFailed) {
      void playScanFeedback("error", t("incoming.cameraListNotReady"));
      setMessage({ tone: "error", text: t("incomingScanListNotReady") });
      return;
    }

    const order = byToken.get(token);
    if (!order) {
      const batchMembers = byBatch.get(token);
      if (batchMembers?.length) {
        const size = Number(batchMembers[0].external_batch_size);
        markBatch(batchMembers, Number.isFinite(size) && size > 0 ? size : batchMembers.length);
        return;
      }
      void resolveRemoteBatch(token);
      return;
    }
    if (scannedIds.has(order.id)) {
      const text = `${orderLabel(order)} — ${t("incomingScanDuplicate")}`;
      void playScanFeedback("error", text);
      setMessage({
        tone: "warn",
        text,
      });
      return;
    }

    void playScanFeedback("success", `${orderLabel(order)} — ${t("incomingScanAdded")}`);
    setScannedIds((prev) => new Set(prev).add(order.id));
    setScannedTokens((prev) => [...prev, token]);
    setMessage({
      tone: "success",
      text: `${orderLabel(order)} — ${t("incomingScanAdded")}`,
      detail: orderDetail(order),
    });
  };

  const handleReceive = () => {
    if (!scannedTokens.length) return;

    receiveByScan.mutate(scannedTokens, {
      onSuccess: (result) => {
        /**
         * ⚠️ QABUL QILINMAGANLARNI KO'RSATISH SHART. Server tokenni
         * moslay olmasa sababini qaytaradi ("tashqi posilka emas",
         * "allaqachon received", "tizimda topilmadi"). Ularni yashirsak
         * operator "hammasi qabul qilindi" deb o'ylab, qolib ketgan
         * posilkani sezmaydi.
         */
        if (result.unmatched.length) {
          const detail = result.unmatched
            .map((u) => `${u.token.slice(0, 10)}… — ${u.reason}`)
            .join("; ");
          setMessage({
            tone: result.received > 0 ? "warn" : "error",
            text: t("incoming.receivePartial", {
              received: result.received,
              failed: result.unmatched.length,
              detail,
            }),
          });
        } else {
          setMessage({
            tone: "success",
            text: `${result.received} ${t("incomingReceiveSuccess")}`,
          });
        }
        setScannedIds(new Set());
        setScannedTokens([]);
        setLastBag(null);
        void query.refetch();
        inputRef.current?.focus();
      },
      onError: (error) => {
        // Backend sababini ATAYLAB ko'rsatamiz — umumiy xabar operatorni
        // ko'r qoldirardi.
        setMessage({
          tone: "error",
          text: getBackendErrorMessage(error) ?? t("incomingReceiveError"),
        });
      },
    });
  };

  /** Kamera «Bekor qilish»: belgi olinadi (server amali hali yo'q — qabul sahifadagi tugma bilan). */
  const unscan = (order: IncomingOrder) => {
    const token = String(order.qr_code_token ?? "").trim();
    setScannedIds((prev) => {
      const next = new Set(prev);
      next.delete(order.id);
      return next;
    });
    setScannedTokens((prev) => prev.filter((item) => item !== token));
  };

  // Kamera ro'yxati — skanerlash tartibida, yangisi birinchi (token — tartib manbai).
  const cameraList: ScanTargetListItem[] = [...scannedTokens]
    .reverse()
    .map((token) => byToken.get(token))
    .filter((order): order is IncomingOrder => Boolean(order))
    .map((order) => ({
      key: order.id,
      title: [orderLabel(order), order.customer?.name?.trim()].filter(Boolean).join(" · "),
      subtitle: [districtName(order), typeof order.total_price === "number" ? formatMoneyLocalized(order.total_price, { language }) : null]
        .filter((part) => part && part !== "—")
        .join(" · "),
      tone: "success",
      onUndo: () => unscan(order),
    }));
  const cameraSource = source ? sourceLabel(source) : t("incoming.untitledSource", { id: marketId });
  const cameraArrived = listReady ? total : orders.length;

  useScanTarget(
    allowed
      ? {
          id: `incoming:${marketId}`,
          title: t("incoming.cameraTitle"),
          context: t("incoming.cameraContext", {
            source: cameraSource,
            count: cameraArrived,
            value: formatNumberLocalized(cameraArrived, { language }),
          }),
          note: { title: t("incoming.cameraNoteTitle"), text: t("incoming.cameraNoteText", { source: cameraSource }) },
          progress: { done: scannedIds.size, total: orders.length, label: t("incoming.cameraMeter") },
          stats:
            bagShortage > 0
              ? [{ key: "bag", label: t("incoming.cameraBagShortage"), value: bagShortage, tone: "warning" }]
              : undefined,
          list: cameraList,
          listTitle: t("incoming.cameraListTitle"),
          switcher: {
            label: cameraSource,
            value: String(marketId ?? ""),
            title: t("incoming.cameraSwitcherTitle"),
            options: async () => {
              const result = await sources.refetch();
              if (result.isError && result.data === undefined) throw result.error;
              return (result.data ?? []).map((item) => ({
                value: item.market_id,
                label: sourceLabel(item),
                meta: t("incoming.parcelsCount", {
                  count: item.orders_count,
                  value: formatNumberLocalized(item.orders_count, { language }),
                }),
              }));
            },
            onSelect: (value) => navigate(`/new-orders/incoming/${value}`),
          },
          onScan: (raw) => handleScan(raw),
          finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
        }
      : null,
  );

  if (!allowed) {
    return <ErrorState kind="forbidden" framed title={t("incomingNoAccess")} description={null} />;
  }

  const scannedCount = scannedIds.size;
  const scannedPercent = orders.length ? Math.min(100, (scannedCount / orders.length) * 100) : 0;
  const scannerReady = listReady && orders.length > 0;
  const ordersSum = orders.reduce(
    (sum, order) => sum + (typeof order.total_price === "number" ? order.total_price : 0),
    0,
  );
  const unit = t("incoming.unitTa");
  const refetch = () => void query.refetch();

  // Manba nomi manbalar ro'yxatidan: yuklanayotganda — skelet (boshqa manba nomi miltillamasin).
  const title = source ? (
    sourceLabel(source)
  ) : sources.isLoading ? (
    <>
      <span className="sr-only">{t("incoming.sourcesTitle")}</span>
      <Skeleton shape="block" width={180} height={28} className="inline-block align-middle" />
    </>
  ) : (
    t("incoming.untitledSource", { id: marketId })
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/new-orders/incoming"
        backLabel={t("incoming.sourcesTitle")}
        title={title}
        description={t("incomingSubtitle")}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={RefreshCw}
              loading={query.isFetching && !query.isLoading}
              onClick={refetch}
            >
              {t("refresh")}
            </Button>
            <Button
              leftIcon={Check}
              disabled={scannedCount === 0}
              loading={receiveByScan.isPending}
              loadingText={t("incomingReceiving")}
              onClick={handleReceive}
            >
              {t("incoming.receive", { count: scannedCount })}
              <span className="max-md:hidden">{t("incoming.receiveUnit", { count: scannedCount })}</span>
            </Button>
          </>
        }
      />

      {/* ===== Skaner + raqamlar + oxirgi natija ===== */}
      <Card aria-label={t("incoming.scanCardLabel")} bodyClassName="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
            <ScanInput
              inputRef={inputRef}
              onScan={handleScan}
              placeholder={t("incomingScanPlaceholder")}
              label={t("incoming.scanInputLabel")}
            />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 max-md:hidden">
              {scannerReady ? (
                <Badge tone="success" dot role="status">
                  {t("incoming.scannerReady")}
                </Badge>
              ) : null}
              <span className="text-xs text-text-muted">{t("incoming.scannerHint")}</span>
            </div>
          </div>

          {/* Raqamlar doim ko'rinadi — operator taxmin qilmasligi kerak. */}
          <dl className="m-0 flex items-end gap-8">
            <div className="flex flex-col gap-0.5">
              <dt className={OVERLINE}>{t("incomingArrived")}</dt>
              <dd className={STAT_VALUE}>
                {listReady ? (
                  <>
                    {formatNumberLocalized(total)}
                    {unit ? <span className={STAT_UNIT}>{unit}</span> : null}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className={OVERLINE}>{t("incomingScanned")}</dt>
              <dd className={STAT_VALUE}>
                {listReady ? (
                  <>
                    <span className="text-success-fg">{formatNumberLocalized(scannedCount)}</span>
                    <span className={STAT_UNIT}>/ {formatNumberLocalized(orders.length)}</span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>

        {scannerReady ? (
          <div
            role="progressbar"
            aria-label={t("incoming.progressLabel")}
            aria-valuemin={0}
            aria-valuemax={orders.length}
            aria-valuenow={scannedCount}
            className="h-2 overflow-hidden rounded-full bg-sunken"
          >
            <span
              className="block h-full rounded-full bg-success transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: `${scannedPercent}%` }}
            />
          </div>
        ) : null}

        {message ? <ScanMessage message={message} /> : null}
      </Card>

      {/* ===== Ro'yxat ===== */}
      {listStale ? (
        <div
          role="alert"
          className={cx("flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}
        >
          <TriangleAlert size={20} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1 font-semibold text-text [overflow-wrap:anywhere]">
            {t("incomingStaleWarning")}
          </span>
          <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={query.isFetching} onClick={refetch}>
            {t("retry")}
          </Button>
        </div>
      ) : null}

      <Card
        padding="none"
        title={t("incoming.listTitle")}
        actions={
          listReady && orders.length > 0 ? (
            <p className="m-0 text-[13px] text-text-muted">
              <Trans
                t={t}
                i18nKey="incoming.listSummary"
                values={{ count: orders.length, sum: formatMoneyLocalized(ordersSum) }}
                components={{ b: <strong className="font-semibold text-text" /> }}
              />
            </p>
          ) : null
        }
      >
        <QueryBoundary
          query={query}
          isEmpty={(data) => data.items.length === 0}
          // Boshqa manbaga o'tilsa (`:marketId` almashdi) oldingi manbaning ro'yxati ko'rsatilmaydi: jadval
          // sahifaning joriy `orders` idan chiziladi, skan ham faqat joriy ro'yxat bilan solishtiriladi — skelet.
          keepPreviousData={false}
          loading={
            <SkeletonTable
              framed={false}
              rows={6}
              columns={["", t("incoming.colOrder"), t("incoming.colCustomer"), t("incoming.colDistrict"), t("incoming.colAmount")]}
            />
          }
          empty={<EmptyState icon={Inbox} title={t("incomingEmpty")} />}
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("incomingLoadError")}
              description={listErrorReason}
              onRetry={retry}
              retrying={query.isFetching}
            />
          )}
        >
          {(_data, { isRefetching }) => (
            <IncomingTable orders={orders} scannedIds={scannedIds} busy={isRefetching} />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

/** Manba almashsa (kamera ichidagi tanlov ham) — skanerlanganlar va xabar yangidan (`key={marketId}`). */
const IncomingOrdersRoute = () => {
  const { marketId } = useParams<{ marketId: string }>();
  return <IncomingOrdersPage key={marketId} />;
};

export default memo(IncomingOrdersRoute);
