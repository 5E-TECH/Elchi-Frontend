// dizayn-v2: superadmin-payments-history-detail-dialog, admin-payments-history-detail-dialog, manager-payments-history-detail-dialog, market-cashbox-history-detail-dialog, courier-cashbox-history-detail, manager-payments-history-detail-dialog-ack, superadmin-payments-history-detail-dialog-receipt, manager-payments-history-detail-dialog-receipt, superadmin-payments-history-detail-dialog-corrected, superadmin-payments-history-detail-dialog-replacement, admin-payments-history-detail-dialog-corrected, manager-payments-history-detail-dialog-corrected, market-cashbox-history-detail-dialog-corrected, courier-cashbox-history-detail-corrected, superadmin-payments-history-detail-dialog-correctable, superadmin-payments-history-detail-dialog-locked
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, MessageSquare, Receipt, ShoppingBag } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canCorrectPayments, canViewOrders } from "../../../app/lib/access";
import type { RootState } from "../../../app/config/store";
import { OrderStatusBadge } from "../../../entities/order";
import {
  useCashBox,
  type FinanceHistoryActor,
  type FinanceHistoryDetail,
} from "../../../entities/payments";
import { toReceiptRef } from "../../../entities/payments/receipt";
import {
  correctionBadgeKindOf,
  historyRowDate,
  paymentCorrectionBadgeKind,
  toPaymentCorrection,
  type PaymentCorrectionRelated,
} from "../../../entities/payments/paymentCorrection";
import {
  buildCorrectionTarget,
  correctionFooterState,
  CorrectAmountDialog,
  PaymentCorrectionFooter,
  ReversePaymentDialog,
  type CorrectionTarget,
} from "../../../features/payment-correction";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Badge,
  Button,
  buttonClasses,
  Dialog,
  ErrorState,
  SkeletonLines,
} from "../../../shared/ui/primitives";
import type { PaymentRow } from "./patmentHistoryTable";
import { getPaymentActorName } from "./paymentHistoryActor";
import {
  getCashboxTypeLabel,
  getPaymentMethodLabel,
  getPaymentSourceTitle,
  getViewerOperationType,
} from "./paymentSourceType";
import CorrectionShiftFlow from "./CorrectionShiftFlow";
import { PaymentAckBadge } from "./PaymentAckBadge";
import { PaymentCorrectionBadge } from "./PaymentCorrectionBadge";
import { PaymentCorrectionSection } from "./PaymentCorrectionSection";
import { getExpenseCategoryName } from "./lib/expenseCategory";
import { paymentAckAudienceOf, toPaymentAck } from "./paymentAck";
import ReceiptSection from "./receipt/ReceiptSection";

/**
 * KASSA TARIXI YOZUVI TAFSILOTI — «Moliya» sahifalarining umumiy oynasi (dizayn v2).
 *
 * Maketlar: `*-payments-history-detail-dialog` (superadmin, admin, menejer), `market-cashbox-history-detail-dialog`,
 * `courier-cashbox-history-detail`. `Dialog` (telefonda pastki varaqa): sarlavha «Kirim operatsiyasi» / «Chiqim
 * operatsiyasi» + «Operatsiyalar tarixi · {sana}»; xulosa — ishorali summa va «Operatsiyadan keyingi balans»;
 * `dl` — Manba turi, Kategoriya (qo'lda chiqimning xarajat kategoriyasi — Elchi Pochta №1, maketda yo'q: yozilgan
 * paytdagi nom, bo'lsagina), Kassa turi (`hideCashboxType` — kuryer maketi), Qayerdan/Qayerga (ism + rol + telefon),
 * To'lov turi, To'lov sanasi; «Izoh»; «Bog'langan buyurtma» (Market, Holat, Tuman, Manzil, Mijoz telefoni + uch
 * summa); pastda «Yopish».
 *
 * Ma'lumot: xulosa qatordan darhol, qolgani `GET /finance/history/:id` dan (yuklanishda skelet, xatoda «Qayta
 * urinish»). Raqamli bo'lmagan ID (virtual «HQ'ga berilishi kerak» qatori, ID siz qator) so'ralmaydi — backend
 * uni 400 bilan qaytarardi. Mos kelmaslik himoyasi: tafsilot kassasi qator kassasidan farq qilsa (boshqa kassa
 * yozuvi), tafsilot ishlatilmaydi — faqat qator ma'lumoti.
 *
 * Yo'nalish ko'ruvchi nuqtai nazaridan (`getViewerOperationType`, ega qarori D2): market o'z kassasida HQ → market
 * o'tkazmasini «Chiqim −» ko'radi — ro'yxatdagi kabi.
 *
 * T6 «To'lov tuzatish» (XXyAZ9ge, maketlar `*-history-detail-dialog-corrected`, `…-replacement`): sarlavha izohida
 * yozuv ID si («Operatsiyalar tarixi · #4498 · Bugun, 13:05»); «Summa» yonida tuzatish belgisi (summa chizilmaydi —
 * ega qarori); xulosadan keyin «Qaytarish va tahrir» bloki (`PaymentCorrectionSection`) — ro'yxat qatoridan darhol,
 * tafsilot kelgach undan (qator eskirgan bo'lishi mumkin); «Bog'liq yozuv» shu oynada o'sha kassadagi juft yozuvni
 * ochadi (`related.id`; ro'yxatda bo'lsa — o'sha qator, `rows`, aks holda sintetik qator). «Tuzatilgan» yozuv
 * sanasi — tuzatish vaqti (`historyRowDate`, C1). Teskari yozuvda «Izoh» sababni takrorlasa — yashiriladi (C6).
 * `correction` kelmagan teskari yozuv (backend fail-open) — belgi manba turidan (ro'yxatdagidek), blok yo'q.
 *
 * T6 N2 (faqat superadmin — `canCorrectPayments`; backend `correctable` ni faqat unga beradi, boshqa rolda tasodifan
 * kelsa ham e'tiborsiz): pastki qism `correctable` bo'yicha (`PaymentCorrectionFooter`, maketlar
 * `superadmin-payments-history-detail-dialog-correctable`, `…-locked`) — muddat izohi + «Qaytarish» / «Summani
 * tahrirlash», yoki qulf izohi, yoki faqat «Yopish» (tafsilot yuklanayotganda, `ALREADY_CORRECTED`, `null`). Amal
 * tanlansa tafsilot oynasi yashirinadi, uning o'rnida forma (`ReversePaymentDialog` / `CorrectAmountDialog`):
 * «Bekor qilish» — tafsilotga qaytadi, oqim tugasa (muvaffaqiyat, `ALREADY_CORRECTED`) — hamma oyna yopiladi.
 * «Smenani ochish» (`SHIFT_REQUIRED`) — `CorrectionShiftFlow` tasdiq ustida, faqat so'ralganda o'rnatiladi.
 */

interface Props {
  row: PaymentRow | null;
  onClose: () => void;
  /** Kuryer `/cash-box` maketida «Kassa turi» qatori yo'q. */
  hideCashboxType?: boolean;
  /**
   * Ro'yxatning yuklangan qatorlari: «Bog'liq yozuv» juft yozuvi shu yerda bo'lsa — o'sha qator ochiladi (ro'yxatdan
   * ochilgandagidek: `payment_ack`, izoh, chek …). Topilmasa — sintetik qator.
   */
  rows?: readonly PaymentRow[];
}

type Party = Partial<FinanceHistoryActor> | null | undefined;

const ROLE_KEYS: Record<string, string> = {
  courier: "v2Common.roles.courier",
  couriers: "v2Common.roles.courier",
  for_courier: "v2Common.roles.courier",
  market: "v2Common.roles.market",
  markets: "v2Common.roles.market",
  for_market: "v2Common.roles.market",
  manager: "v2Common.roles.manager",
  registrator: "v2Common.roles.registrator",
  admin: "v2Common.roles.admin",
  superadmin: "v2Common.roles.superadmin",
  customer: "v2Common.roles.customer",
  branch: "v2Common.roles.branch",
  branches: "v2Common.roles.branch",
  for_branch: "v2Common.roles.branch",
  main: "v2Common.roles.main",
  hq: "v2Common.roles.main",
};

const getHistoryCashboxId = (item?: Partial<FinanceHistoryDetail | PaymentRow> | null) =>
  item?.cashbox_id != null ? String(item.cashbox_id) : item?.cashbox?.id != null ? String(item.cashbox.id) : "";

/** Backend tarix ID si — bigint satr; boshqasi (virtual qator, mahalliy kalit) so'ralmaydi. */
const isFetchableId = (id?: string | null) => Boolean(id && /^\d+$/.test(id));

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "";

/** `.el-kv` — atama: qiymat (maket: chap ustun 110 px … 32%). */
const KV = "m-0 grid grid-cols-[minmax(110px,32%)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm";
const DT = "text-text-muted";
const DD = "m-0 min-w-0 break-words font-semibold text-text";
const SUNKEN = "rounded-xl bg-sunken";

const FinanceHistoryDetailPopup = memo(({ row, onClose, hideCashboxType = false, rows }: Props) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const viewerRole = useSelector((state: RootState) => state.role.role);
  const orderLinkAllowed = useSelector(canViewOrders);
  const canCorrect = useSelector(canCorrectPayments);
  const { useGetFinanceHistoryById } = useCashBox();

  // Yopilish harakati (200 ms) davomida oxirgi qator ko'rinib turadi.
  const [shownRow, setShownRow] = useState<PaymentRow | null>(row);
  if (row && row !== shownRow) setShownRow(row);
  // T6 «Bog'liq yozuv»: o'sha oynada juft yozuv (qatorning o'rnini bosadi). Ro'yxatdan boshqa qator ochilsa — tashlanadi.
  const [relatedRow, setRelatedRow] = useState<PaymentRow | null>(null);
  // T6 N2: tuzatish oqimi — tanlangan amal va nishon (bosilgan paytdagi yozuv; oqim davomida o'zgarmaydi).
  const [mode, setMode] = useState<"reverse" | "edit" | null>(null);
  const [flowTarget, setFlowTarget] = useState<CorrectionTarget | null>(null);
  const [baseRow, setBaseRow] = useState<PaymentRow | null>(row);
  if (row !== baseRow) {
    setBaseRow(row);
    setMode(null);
    if (row) setRelatedRow(null);
  }
  const current = relatedRow ?? row ?? shownRow;
  const open = row != null;
  // «Smenani ochish» (`SHIFT_REQUIRED`): oyna faqat so'ralganda o'rnatiladi. Smena ochilgach tasdiqqa xabar beriladi
  // (`onOpened` — eski «Smena ochilmagan» qutisi olib tashlanadi).
  const [shiftMounted, setShiftMounted] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const shiftOpenedRef = useRef<(() => void) | null>(null);
  const openShift = useCallback(({ onOpened }: { onOpened: () => void }) => {
    shiftOpenedRef.current = onOpened;
    setShiftMounted(true);
    setShiftOpen(true);
  }, []);
  const closeShift = useCallback(() => {
    shiftOpenedRef.current = null;
    setShiftOpen(false);
  }, []);
  const shiftOpened = useCallback(() => {
    const notifyConfirm = shiftOpenedRef.current;
    shiftOpenedRef.current = null;
    setShiftOpen(false);
    notifyConfirm?.();
  }, []);

  // Oynani ochgan element (ro'yxat qatori): tafsilot va forma bir-birining o'rnini egallaydi, shuning uchun har
  // oynaning «avvalgi fokusi» — DOM'dan ketgan tugma. Oqim qanday tugamasin (muvaffaqiyat, ALREADY_CORRECTED dan
  // keyin «Orqaga», «Bekor qilish» → «Yopish») fokus shu elementga qaytadi. Layout effekt — oyna fokusni panelga
  // ko'chirishidan (passiv effekt) oldin.
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);

  const rowId = current?.id ?? null;
  const canFetch = isFetchableId(rowId);
  const detailQuery = useGetFinanceHistoryById(canFetch ? rowId : null, open && canFetch);
  const { data, isLoading, isError, error, refetch } = detailQuery;

  const fetchedDetail = canFetch ? data?.data : undefined;
  const rowCashboxId = getHistoryCashboxId(current);
  const detailCashboxId = getHistoryCashboxId(fetchedDetail);
  const isMismatchedDetail = Boolean(rowCashboxId && detailCashboxId && rowCashboxId !== detailCashboxId);
  const detail = isMismatchedDetail ? null : fetchedDetail;

  // T6: tuzatish — avval tafsilotdan (tuzatishdan keyin ro'yxat qatori eskirgan bo'ladi), bo'lmasa qatordan.
  const correction = useMemo(
    () => toPaymentCorrection(detail && detail.correction !== undefined ? detail.correction : current?.correction),
    [current, detail],
  );

  // Qator ustun (ro'yxatdagi yo'nalish/summa bilan bir xil), bo'sh maydon — tafsilotdan.
  const display = useMemo(() => {
    if (!current) return null;
    return {
      operation_type: current.operation_type ?? detail?.operation_type ?? undefined,
      amount: current.amount ?? detail?.amount,
      balance_after: current.balance_after ?? detail?.balance_after,
      source_type: current.source_type ?? detail?.source_type ?? undefined,
      payment_method: current.payment_method ?? detail?.payment_method ?? undefined,
      // «Tuzatilgan» — tuzatish vaqti (C1, `historyRowDate`), qolganlari — to'lov sanasi, bo'lmasa yaratilgan vaqt.
      payment_date: historyRowDate({
        correction,
        payment_date: current.payment_date ?? detail?.payment_date,
        createdAt: current.createdAt ?? detail?.createdAt,
        created_at: current.created_at,
      }),
      comment: current.comment ?? detail?.comment ?? undefined,
      expense_category_name: getExpenseCategoryName(current) ?? getExpenseCategoryName(detail),
      cashbox_type: current.cashbox_type ?? current.cashbox?.cashbox_type ?? detail?.cashbox?.cashbox_type,
    };
  }, [correction, current, detail]);

  const direction = getViewerOperationType(display, viewerRole);
  const isIncome = direction === "income";

  // Qarshi tomon: manba foydalanuvchisi (kuryer/market — `courier_payment`, `market_payment`), bo'lmasa yozuvni
  // yaratgan, so'ng kassa egasi.
  const party: Party = useMemo(
    () =>
      [
        detail?.source_user,
        detail?.sourceUser,
        current?.source_user,
        current?.sourceUser,
        detail?.created_by_user,
        detail?.createdByUser,
        current?.created_by_user,
        current?.createdByUser,
        detail?.cashbox?.user,
        detail?.user,
        current?.user,
      ].find((actor) => actor && getPaymentActorName(actor)) ?? null,
    [current, detail],
  );

  const money = (value: unknown) => formatMoneyLocalized(value, { language });
  const dateTime = (value: unknown) =>
    hasValue(value) ? formatDateTimeLocalized(value as string, { language }) : "—";
  const roleLabel = (value?: string | null) => {
    const key = ROLE_KEYS[(value ?? "").trim().toLowerCase()];
    return key ? t(key) : null;
  };

  if (!current || !display) return null;

  const amount = Math.abs(toFiniteNumber(display.amount) ?? 0);
  const signedAmount = direction === "expense" ? -amount : amount;
  const amountText = formatSignedMoneyLocalized(signedAmount, { language, withCurrency: false });
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];
  const balanceAfter = toFiniteNumber(display.balance_after);
  const dateText = dateTime(display.payment_date);
  const title = direction
    ? t(isIncome ? "v2HistoryDetail.incomeTitle" : "v2HistoryDetail.expenseTitle")
    : t("v2HistoryDetail.operationTitle");

  const partyName = getPaymentActorName(party) || (party?.id != null ? `#${party.id}` : "");
  const partyRole = roleLabel(party?.role) ?? roleLabel(display.cashbox_type);
  const partyPhone = party?.phone_number?.trim() || party?.phone?.trim() || "";
  // C6: teskari yozuvda backend `comment` ga sababni yozadi — blokdagi «Sabab» bilan bir xil bo'lsa «Izoh» chiqmaydi.
  const rawComment = display.comment?.trim();
  const comment =
    rawComment && correction?.role === "reversal" && rawComment === correction.reason.trim() ? "" : rawComment;
  // `correction` kelmagan teskari yozuv (backend fail-open) — belgi manba turidan, ro'yxatdagidek; blok chiqmaydi.
  const correctionKind = correction
    ? correctionBadgeKindOf(correction.role, correction.action)
    : paymentCorrectionBadgeKind({ source_type: display.source_type });
  const correctionCashboxType = display.cashbox_type;
  const sourceTitle = getPaymentSourceTitle(display.source_type, t, {
    role: viewerRole,
    cashboxType: display.cashbox_type,
    paymentMethod: display.payment_method,
  });

  // T6 N2: pastki qism — faqat superadmin va tafsilot kelgach (yuklanishda, xatoda, boshqa rolda — faqat «Yopish»).
  const correctable = canFetch ? detail?.correctable : undefined;
  const footerState = correctionFooterState(canCorrect, correctable, current.id);
  const startCorrection = (next: "reverse" | "edit") => {
    const target = buildCorrectionTarget({
      id: current.id,
      amount: display.amount,
      title: sourceTitle,
      createdAt: display.payment_date || null,
      paymentMethod: display.payment_method ?? null,
      correctable,
    });
    if (!target) return;
    setFlowTarget(target);
    setMode(next);
  };

  // «Bog'liq yozuv»: o'sha kassadagi juft oyoq. Ro'yxatdan ochilgan qatorning o'zi — unga qaytiladi; ro'yxatda bor —
  // o'sha qator (kvitansiya javobi, izoh, chek saqlanadi); yo'q — sintetik qator (`GET finance/history/:id` qolganini beradi).
  const openRelated = (related: PaymentCorrectionRelated, event: MouseEvent<HTMLButtonElement>) => {
    const panel = event.currentTarget.closest<HTMLElement>("[aria-modal='true']");
    const currentCashboxId = getHistoryCashboxId(current);
    const listed = rows?.find((item) => {
      if (String(item.id) !== related.id) return false;
      const itemCashboxId = getHistoryCashboxId(item);
      return !itemCashboxId || !currentCashboxId || itemCashboxId === currentCashboxId;
    });
    if (row && String(row.id) === related.id) setRelatedRow(null);
    else
      setRelatedRow(
        listed ?? {
          id: related.id,
          amount: related.amount,
          operation_type: related.operation_type ?? undefined,
          source_type: related.source_type || undefined,
          cashbox_id: current.cashbox_id ?? current.cashbox?.id,
          cashbox_type: current.cashbox_type ?? current.cashbox?.cashbox_type ?? detail?.cashbox?.cashbox_type,
          createdAt: related.created_at ?? undefined,
        },
      );
    // Yangi mazmun boshidan ko'rinsin, fokus oynada qolsin (bosilgan qator DOM'dan ketadi).
    const body = panel?.querySelector<HTMLElement>("[data-dialog-body]");
    if (body) body.scrollTop = 0;
    panel?.focus();
  };
  // 2crjWf7v: kuryerning bot kvitansiyasiga javobi — faqat «Kuryerdan qabul» qatorida (ro'yxat qatoridan;
  // boshqa qatorlarda maydon yo'q → qator chizilmaydi). Maket `manager-payments-history-detail-dialog-ack`;
  // matn ko'ruvchiga qarab (KI-S1): kuryer — «Siz tasdiqlagansiz», xodim — «Kuryer tasdiqladi».
  const paymentAck = toPaymentAck(current?.payment_ack);
  const paymentAckAudience = paymentAckAudienceOf(viewerRole);

  // Chek (QlLf33Ma): kuryer, market va boshqa rollarda `receipt` kaliti kelmaydi — bo'lim chiqmaydi.
  const receiptId = toReceiptRef(detail?.receipt)?.id ?? toReceiptRef(current?.receipt)?.id ?? null;

  const order = detail?.order ?? null;
  const orderId = order?.id != null ? String(order.id) : "";
  const locationLabel = [
    order?.district?.name ?? order?.customer?.district?.name ?? "",
    order?.region?.name ?? order?.customer?.region?.name ?? "",
  ]
    .filter(Boolean)
    .join(", ");
  const orderPhone =
    order?.customer?.phone_number || order?.customer?.phone || order?.customer?.extra_number || "";
  const orderAddress = order?.address || order?.customer?.address || "";
  const orderTotal = toFiniteNumber(order?.total_price) ?? 0;
  const orderToBePaid = toFiniteNumber(order?.to_be_paid) ?? 0;
  const orderPaid = toFiniteNumber(order?.paid_amount) ?? 0;
  const orderSums: Array<[string, number]> = [
    // «Jami summa» — `total_price`; faqat maydon kelmasa `to_be_paid` (haqiqiy 0 almashtirilmaydi).
    [t("v2HistoryDetail.orderTotal"), hasValue(order?.total_price) ? orderTotal : orderToBePaid],
    [t("v2HistoryDetail.toBePaid"), orderToBePaid],
    [t("v2HistoryDetail.paid"), orderPaid],
  ];

  const kvRow = (label: string, value: ReactNode) => (
    <>
      <dt className={DT}>{label}</dt>
      <dd className={DD}>{value}</dd>
    </>
  );

  const details = (
    <>
      <dl className={KV}>
        {kvRow(t("v2HistoryDetail.sourceType"), sourceTitle)}
        {display.expense_category_name
          ? kvRow(
              t("v2HistoryDetail.category"),
              <span data-expense-category="">{display.expense_category_name}</span>,
            )
          : null}
        {hideCashboxType
          ? null
          : kvRow(t("v2HistoryDetail.cashboxType"), getCashboxTypeLabel(display.cashbox_type, t, viewerRole))}
        {partyName
          ? kvRow(
              t(isIncome ? "v2HistoryDetail.from" : "v2HistoryDetail.to"),
              <>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{partyName}</span>
                  {partyRole ? <Badge>{partyRole}</Badge> : null}
                </span>
                {partyPhone ? (
                  <span className="block whitespace-nowrap text-[13px] font-normal text-text-muted">
                    {formatPhone(partyPhone)}
                  </span>
                ) : null}
              </>,
            )
          : null}
        {kvRow(t("v2HistoryDetail.paymentType"), getPaymentMethodLabel(display.payment_method, t))}
        {kvRow(t("v2HistoryDetail.paymentDate"), dateText)}
        {paymentAck !== undefined
          ? kvRow(
              t("v2HistoryDetail.paymentAck"),
              paymentAck ? (
                <PaymentAckBadge ack={paymentAck} audience={paymentAckAudience} />
              ) : (
                <span className="font-normal text-text-muted">{t("v2HistoryDetail.paymentAckNone")}</span>
              ),
            )
          : null}
      </dl>

      {comment ? (
        <div className={cx(SUNKEN, "flex items-start gap-3 px-4 py-3")}>
          <MessageSquare aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-text-muted" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
              {t("v2HistoryDetail.comment")}
            </span>
            <p className="m-0 whitespace-pre-line break-words text-sm text-text">{comment}</p>
          </div>
        </div>
      ) : null}

      {order ? (
        <section
          aria-labelledby="history-detail-order"
          className="flex flex-col gap-3 border-t border-border pt-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id="history-detail-order" className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-text">
              <ShoppingBag aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
              {t("v2HistoryDetail.linkedOrder")}
            </h3>
            {orderId ? (
              orderLinkAllowed ? (
                <Link
                  to={`/orders/edit/${encodeURIComponent(orderId)}`}
                  aria-label={t("v2HistoryDetail.openOrder", { id: orderId })}
                  className={buttonClasses({ variant: "link", size: "sm", className: "max-md:h-11" })}
                >
                  {t("v2HistoryDetail.orderNumber", { id: orderId })}
                  <ChevronRight aria-hidden="true" size={16} className="shrink-0" />
                </Link>
              ) : (
                <span className="text-sm font-semibold text-text">
                  {t("v2HistoryDetail.orderNumber", { id: orderId })}
                </span>
              )
            ) : null}
          </div>
          <dl className={KV}>
            {kvRow(t("v2HistoryDetail.market"), order.market?.name?.trim() || "—")}
            {kvRow(
              t("v2HistoryDetail.status"),
              order.status ? <OrderStatusBadge status={order.status} /> : "—",
            )}
            {kvRow(t("v2HistoryDetail.district"), locationLabel || "—")}
            {orderAddress ? kvRow(t("v2HistoryDetail.address"), orderAddress) : null}
            {kvRow(t("v2HistoryDetail.customerPhone"), orderPhone ? formatPhone(orderPhone) : "—")}
          </dl>
          {/* Uch summa: kompyuterda yonma-yon bloklar, telefonda — `dl` (maket `el-hide-mobile` / `el-show-mobile`). */}
          <div className="grid grid-cols-3 gap-2 max-md:hidden">
            {orderSums.map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-sunken px-3 py-2.5">
                <span className="text-xs text-text-muted">{label}</span>
                <span className="whitespace-nowrap text-sm font-semibold text-text">{money(value)}</span>
              </div>
            ))}
          </div>
          <dl className={cx(SUNKEN, "m-0 hidden grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-2 px-4 py-3 text-sm max-md:grid")}>
            {orderSums.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className={DT}>{label}</dt>
                <dd className="m-0 whitespace-nowrap text-right font-semibold text-text">{money(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );

  return (
    <>
      <Dialog
        // Tuzatish oynasi ochiq bo'lsa tafsilot yashirinadi (maket: forma uning o'rnida), «Bekor qilish» — qaytadi.
        open={open && mode === null}
        onClose={onClose}
        onExited={() => {
          // Tuzatish oynasiga o'tishda (yozuv hali tanlangan) — «Bog'liq yozuv» va oxirgi qator saqlanadi.
          if (row) return;
          setShownRow(null);
          setRelatedRow(null);
        }}
        size="lg"
        icon={direction === "expense" ? ArrowUpRight : direction === "income" ? ArrowDownLeft : Receipt}
        title={title}
        // Sana bir qatorda (telefonda «Bugun, 13:05» bo'linmaydi — maket).
        description={
          <Trans
            t={t}
            i18nKey={canFetch ? "v2HistoryDetail.subtitleWithId" : "v2HistoryDetail.subtitle"}
            values={canFetch ? { id: current.id, date: dateText } : { date: dateText }}
            components={{ date: <span className="whitespace-nowrap" /> }}
          />
        }
        closeLabel={t("v2HistoryDetail.close")}
        initialFocus="panel"
        returnFocus={openerRef}
        footer={
          footerState.kind === "none" ? (
            <Button variant="secondary" onClick={onClose}>
              {t("v2HistoryDetail.close")}
            </Button>
          ) : (
            <PaymentCorrectionFooter
              state={footerState}
              closeLabel={t("v2HistoryDetail.close")}
              onClose={onClose}
              onReverse={() => startCorrection("reverse")}
              onCorrect={() => startCorrection("edit")}
              changeWindowTo="/payments/shift-settings"
            />
          )
        }
      >
        <div className={cx(SUNKEN, "flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4")}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-text-muted">{t("v2HistoryDetail.amount")}</span>
              <PaymentCorrectionBadge kind={correctionKind} />
            </span>
            <span
              data-history-amount=""
              className={cx(
                "whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] proportional-nums max-md:text-[22px] max-md:leading-[30px]",
                direction === "income" ? "text-success-fg" : direction === "expense" ? "text-danger-fg" : "text-text",
              )}
            >
              {amountText}
              <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">{currency}</span>
            </span>
          </div>
          {balanceAfter !== null ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-text-muted">{t("v2HistoryDetail.balanceAfter")}</span>
              <span className="whitespace-nowrap text-sm font-semibold text-text">{money(balanceAfter)}</span>
            </div>
          ) : null}
        </div>

        {correction ? (
          <PaymentCorrectionSection
            correction={correction}
            viewerRole={viewerRole}
            cashboxType={correctionCashboxType}
            onOpenRelated={openRelated}
          />
        ) : null}

        {receiptId ? (
          <ReceiptSection
            receiptId={receiptId}
            operation={[sourceTitle, dateText].filter(Boolean).join(" · ")}
          />
        ) : null}

        {canFetch && isLoading ? (
          <div role="status" aria-label={t("v2HistoryDetail.loading")}>
            <SkeletonLines lines={5} />
          </div>
        ) : canFetch && isError && !detail ? (
          <ErrorState
            error={error}
            title={t("v2HistoryDetail.loadError")}
            onRetry={() => void refetch()}
          />
        ) : (
          details
        )}
      </Dialog>
      {flowTarget ? (
        <>
          <ReversePaymentDialog
            open={open && mode === "reverse"}
            target={flowTarget}
            onCancel={() => setMode(null)}
            onDone={onClose}
            onOpenShift={openShift}
            returnFocus={openerRef}
          />
          <CorrectAmountDialog
            open={open && mode === "edit"}
            target={flowTarget}
            onCancel={() => setMode(null)}
            onDone={onClose}
            onOpenShift={openShift}
            returnFocus={openerRef}
          />
        </>
      ) : null}
      {shiftMounted ? <CorrectionShiftFlow open={shiftOpen} onClose={closeShift} onOpened={shiftOpened} /> : null}
    </>
  );
});

FinanceHistoryDetailPopup.displayName = "FinanceHistoryDetailPopup";

export default FinanceHistoryDetailPopup;
