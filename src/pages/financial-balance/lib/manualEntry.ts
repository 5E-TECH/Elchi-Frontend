/**
 * QO'LDA DAFTAR YOZUVI (GtAoqHlk) — manba turlari va payload.
 * ⚠️ Payload AYNAN `{ amount, source_type, comment }` (gateway DTO
 * `forbidNonWhitelisted`); summa ishorali — kirim +, chiqim −.
 */

export const MANUAL_ENTRY_SOURCES = ["manual_expense", "manual_income", "bills", "salary", "correction"] as const;
export type ManualEntrySource = (typeof MANUAL_ENTRY_SOURCES)[number];

export const SOURCE_LABEL_KEYS: Record<ManualEntrySource, string> = {
  manual_expense: "financialBalanceSourceManualExpense",
  manual_income: "financialBalanceSourceManualIncome",
  bills: "financialBalanceSourceBills",
  salary: "financialBalanceSourceSalary",
  correction: "financialBalanceSourceCorrection",
};

/** Tuzatishdan boshqa turlarning ishorasi qat'iy. */
export const FIXED_DIRECTION: Partial<Record<ManualEntrySource, 1 | -1>> = {
  manual_income: 1,
  manual_expense: -1,
  bills: -1,
  salary: -1,
};

export const MIN_COMMENT_LENGTH = 3;
export const MAX_AMOUNT = 10_000_000_000;

export const newEntryKey = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const buildManualEntryPayload = (
  source: ManualEntrySource,
  amount: number,
  direction: 1 | -1,
  comment: string,
) => ({
  amount: Math.abs(amount) * (FIXED_DIRECTION[source] ?? direction),
  source_type: source,
  comment: comment.trim(),
});
