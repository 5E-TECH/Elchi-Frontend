import {
  PAYMENT_CORRECTION_METHODS,
  toPaymentCorrectable,
  type PaymentCorrectable,
  type PaymentCorrectableParty,
  type PaymentCorrectionMethod,
} from "../../../entities/payments/paymentCorrection";

/**
 * T6 N2 — tuzatiladigan to'lov (oynalar uchun yagona kirish). Tafsilot oynasi (`FinanceHistoryDetailPopup`) uni
 * o'zining birlashtirilgan qatoridan quradi — sahifa turlari (`PaymentRow`) feature ichiga kirmaydi (FSD).
 *
 * To'lov tomonlari `correctable.transfer` dan (backend #623, ega qarori 2026-11-03 C2): dialog qaysi oyoqdan
 * ochilmasin — kuryer, qabul qiluvchi kassa (MAIN yoki filial) va market aniq. `transfer` yo'q (eski backend) yoki
 * nom `null` — umumiy matn: nom o'ylab topilmaydi, oyna yiqilmaydi.
 */

export type CorrectionTarget = {
  /** Ko'rilayotgan oyoq (`cashbox_history.id`) — POST `:id` (backend istalgan oyoqni qabul qiladi). */
  id: string;
  /** Oyoq summasi (musbat); `transfer.amount` bo'lsa — o'sha ustun. */
  amount: number;
  /** Oyoq sarlavhasi (tafsilot oynasi hisoblagani, masalan «Kuryer to'lovi») — tur noma'lum bo'lsa tavsifda. */
  title: string;
  /** Oyoq yozilgan vaqt (ISO) — tavsif. */
  createdAt: string | null;
  /** Oyoq usuli (`transfer` yo'q bo'lsa). */
  paymentMethod: string | null;
  /** Normalizatsiya qilingan `correctable` (faqat superadmin tafsilotida). */
  correctable: PaymentCorrectable;
};

export type BuildCorrectionTargetInput = {
  id: string | number | null | undefined;
  amount: unknown;
  title: string;
  createdAt?: string | null;
  paymentMethod?: string | null;
  /** Backend `correctable` (xom yoki normalizatsiya qilingan). */
  correctable: unknown;
};

/**
 * Popup ma'lumotidan `CorrectionTarget`. Raqamli ID (virtual qator emas) va `correctable` obyekt bo'lmasa — `null`
 * (tugma chizilmaydi).
 */
export const buildCorrectionTarget = (input: BuildCorrectionTargetInput): CorrectionTarget | null => {
  const id = input.id === null || input.id === undefined ? "" : String(input.id).trim();
  if (!/^\d{1,19}$/.test(id)) return null;
  const correctable = toPaymentCorrectable(input.correctable);
  if (!correctable) return null;
  const parsed = Number(input.amount);
  return {
    id,
    amount: Number.isFinite(parsed) ? Math.abs(parsed) : 0,
    title: input.title,
    createdAt: input.createdAt ?? null,
    paymentMethod: typeof input.paymentMethod === "string" ? input.paymentMethod.trim().toLowerCase() || null : null,
    correctable,
  };
};

/** To'lov shakli: oddiy kuryer to'lovi, marketga to'lov, kuryerdan marketga o'tkazma (click_to_market). */
export type CorrectionKind = "courier" | "market" | "clickToMarket";

export type CorrectionShape = {
  /** `null` — shakl noma'lum (eski backend, `transfer` yo'q): umumiy matn. */
  kind: CorrectionKind | null;
  /** Pulni olgan kassa: kuryer to'lovida MAIN yoki filial, marketga to'lovda — MAIN; noma'lum — `null`. */
  receiver: "main" | "branch" | null;
  method: PaymentCorrectionMethod | null;
  /** To'lov summasi (`transfer.amount`, bo'lmasa oyoq summasi). */
  amount: number;
  courier: PaymentCorrectableParty | null;
  market: PaymentCorrectableParty | null;
  /** Filial kassasi (receiver `branch`): ID va nom (nom topilmasa — `null`). */
  branch: { id: string | null; name: string | null } | null;
};

const methodOf = (value: string | null | undefined): PaymentCorrectionMethod | null =>
  value && (PAYMENT_CORRECTION_METHODS as readonly string[]).includes(value) ? (value as PaymentCorrectionMethod) : null;

/** `correctable.transfer` → shakl; yo'q bo'lsa — umumiy (`kind: null`, faqat summa va oyoq usuli). */
export const deriveCorrectionShape = (target: CorrectionTarget): CorrectionShape => {
  const transfer = target.correctable.transfer ?? null;
  if (!transfer) {
    return {
      kind: null,
      receiver: null,
      method: methodOf(target.paymentMethod),
      amount: target.amount,
      courier: null,
      market: null,
      branch: null,
    };
  }
  const method = transfer.payment_method ?? methodOf(target.paymentMethod);
  const kind: CorrectionKind =
    transfer.kind === "market_payment" ? "market" : method === "click_to_market" ? "clickToMarket" : "courier";
  return {
    kind,
    receiver: transfer.receiver.cashbox_type,
    method,
    amount: transfer.amount ?? target.amount,
    courier: transfer.courier,
    market: transfer.market,
    branch:
      transfer.receiver.cashbox_type === "branch"
        ? { id: transfer.receiver.branch_id, name: transfer.receiver.name }
        : null,
  };
};

/**
 * Tafsilot oynasi pastki qismi (superadmin):
 *  - `actions` — «Qaytarish» va «Summani tahrirlash» + muddat izohi (`chained` — zanjirning birinchi to'lovidan);
 *  - `lock` — tushuntirish (`Lock`), faqat «Yopish» (`WINDOW_EXPIRED`, `LEGACY_UNLINKED`, `NOT_CORRECTABLE`,
 *    `COURIER_MOVED`);
 *  - `none` — hech narsa, faqat «Yopish»: `canCorrect` yo'q (admin — tasodifiy `correctable` bo'lsa ham), `correctable`
 *    yo'q / `null`, yoki `ALREADY_CORRECTED` (blok o'zi tushuntiradi; ega qarori 2026-11-03).
 */
export type CorrectionFooterState =
  | { kind: "none" }
  | { kind: "actions"; deadline: string | null; windowDays: number; rootHistoryId: string | null; chained: boolean }
  | { kind: "lock"; correctable: PaymentCorrectable };

export const correctionFooterState = (
  canCorrect: boolean,
  rawCorrectable: unknown,
  historyId: string | number | null | undefined,
): CorrectionFooterState => {
  if (!canCorrect) return { kind: "none" };
  const correctable = toPaymentCorrectable(rawCorrectable);
  if (!correctable) return { kind: "none" };
  if (correctable.allowed) {
    const id = historyId === null || historyId === undefined ? "" : String(historyId);
    return {
      kind: "actions",
      deadline: correctable.deadline,
      windowDays: correctable.window_days,
      rootHistoryId: correctable.root_history_id,
      chained: Boolean(correctable.root_history_id) && correctable.root_history_id !== id,
    };
  }
  if (!correctable.code || correctable.code === "ALREADY_CORRECTED") return { kind: "none" };
  return { kind: "lock", correctable };
};
