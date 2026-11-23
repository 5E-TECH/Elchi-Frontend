import axios from "axios";
import { toISODate } from "../../../shared/lib/dateRange";

/** «To'lovlar» tabi — `/market-operators?view=payments` (F2qp6FtE). */
export const PAYMENTS_VIEW = "payments";

/** Backend `numeric(14,2)` chegarasi (so'm, butun). */
export const PAYMENT_AMOUNT_MAX = 999_999_999_999;
/** Backend: izoh ≤ 500, sabab 3…500 belgi. */
export const PAYMENT_NOTE_MAX = 500;
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 500;

/** Backend: to'lov sanasi 2020-01-01 dan oldin bo'lmaydi («To'lov sanasi juda eski»). */
export const PAYMENT_DATE_MIN = "2020-01-01";

const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Bugungi sana `YYYY-MM-DD` — Toshkent kuni (backend kelajakni shu kun bo'yicha rad etadi; brauzer soati yoki mintaqasi
 * oldinda bo'lsa ham forma backend bilan bir xil chegarani ko'rsatadi).
 */
export const todayIso = (now: Date = new Date()) => {
  const text = TASHKENT_DAY.format(now);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : toISODate(now);
};

/** `TextInput mode="money"` qiymati (faqat raqamlar) → son; bo'sh — 0. */
export const parseAmountDigits = (value: string): number => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

export type PaymentFormErrors = Partial<
  Record<
    "operator" | "amount" | "date",
    "operator" | "amount" | "amountTooBig" | "amountOverDeleted" | "date" | "dateFuture" | "dateTooOld"
  >
>;

/**
 * Forma tekshiruvi (backend bilan bir xil qoidalar): operator, summa > 0 va chegarada, sana — bugundan keyin emas.
 * `maxAmount` — o'chirilgan operatorning qoldig'i (audit 2026-11-22 #10: unga faqat qoldiqni yopish uchun yoziladi;
 * oshsa backend 409 beradi).
 */
export const validatePaymentForm = (
  input: { operatorId: string; amount: number; paidAt: string; maxAmount?: number },
  today: string = todayIso(),
): PaymentFormErrors => {
  const errors: PaymentFormErrors = {};
  if (!input.operatorId) errors.operator = "operator";
  if (!(input.amount > 0)) errors.amount = "amount";
  else if (input.amount > PAYMENT_AMOUNT_MAX) errors.amount = "amountTooBig";
  else if (input.maxAmount !== undefined && input.amount > input.maxAmount) errors.amount = "amountOverDeleted";
  if (!input.paidAt) errors.date = "date";
  else if (input.paidAt > today) errors.date = "dateFuture";
  else if (input.paidAt < PAYMENT_DATE_MIN) errors.date = "dateTooOld";
  return errors;
};

/**
 * Natija noma'lum: javob kelmadi (tarmoq / vaqt chegarasi) yoki 5xx (gateway 504 — RPC orqada tugagan bo'lishi
 * mumkin). Yozuv yaratilgan bo'lishi mumkin — foydalanuvchi oynani yopmasdan AYNI kalit bilan qayta yuborsin.
 */
export const isUnknownPaymentOutcome = (status: number | null) => status === null || status >= 500;

/** So'rov xatosining HTTP holati (tarmoq xatosi — `null`). */
export const paymentHttpStatus = (error: unknown): number | null =>
  axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
