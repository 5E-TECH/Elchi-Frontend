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

/** Bugungi sana `YYYY-MM-DD` (brauzer kuni; backend Toshkent kuni bo'yicha kelajakni rad etadi). */
export const todayIso = (now: Date = new Date()) => toISODate(now);

/** `TextInput mode="money"` qiymati (faqat raqamlar) → son; bo'sh — 0. */
export const parseAmountDigits = (value: string): number => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

export type PaymentFormErrors = Partial<Record<"operator" | "amount" | "date", "operator" | "amount" | "amountTooBig" | "date" | "dateFuture">>;

/** Forma tekshiruvi (backend bilan bir xil qoidalar): operator, summa > 0 va chegarada, sana — bugundan keyin emas. */
export const validatePaymentForm = (
  input: { operatorId: string; amount: number; paidAt: string },
  today: string = todayIso(),
): PaymentFormErrors => {
  const errors: PaymentFormErrors = {};
  if (!input.operatorId) errors.operator = "operator";
  if (!(input.amount > 0)) errors.amount = "amount";
  else if (input.amount > PAYMENT_AMOUNT_MAX) errors.amount = "amountTooBig";
  if (!input.paidAt) errors.date = "date";
  else if (input.paidAt > today) errors.date = "dateFuture";
  return errors;
};

/** So'rov xatosining HTTP holati (tarmoq xatosi — `null`). */
export const paymentHttpStatus = (error: unknown): number | null =>
  axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
