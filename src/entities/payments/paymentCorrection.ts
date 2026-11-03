/**
 * TO'LOVNI TUZATISH (T6, backend `docs/frontend/FRONTEND_CHANGELOG.md` 2026-10-30 «T6», 2026-10-31 iPlY5yop) —
 * kassa tarixi qatoridagi `correction` obyektining kontrakti va normalizatori.
 *
 * Backend har tarix qatoriga (`GET finance/history`, `…/history/:id`, `cashbox/main`, `cashbox/my-cashbox`,
 * `cashbox/user/:id/main`, `cashbox/user/:user_id`) `transfer_id`, `reverses_history_id` va `correction` qo'shadi:
 *  - `correction === null` — qator tuzatilmagan (yoki qidiruv yiqildi — backend fail-open);
 *  - `role: "original"` — asl to'lov (`action: "reverse"` → «Qaytarildi», `"edit"` → «Tahrirlangan»); asl yozuv
 *    hech qachon o'zgarmaydi (ega qarori: summa chizilmaydi, xiralashmaydi — faqat belgi);
 *  - `role: "reversal"` — teskari yozuv (`source_type: "payment_reversal"`, summasi asl bilan bir xil, yo'nalishi
 *    teskari; `comment` = sabab) → «Teskari yozuv»;
 *  - `role: "replacement"` — tahrirdan keyingi yangi to'lov → «Tuzatilgan».
 * `related` — shu kassadagi juft oyoq («Bog'liq yozuv»): `original` uchun yangi to'lov (edit) yoki teskari yozuv
 * (reverse), `reversal` va `replacement` uchun — asl to'lov. `reason` va `created_by_name` barcha rollarga keladi.
 *
 * `correctable` — faqat superadmin uchun, faqat `GET finance/history/:id` da (N2 tugmalari; bu yerda faqat tur).
 *
 * Modul React va `entities/payments/index` siz: ro'yxatlar va tafsilot oynasi uni yo'l bo'yicha import qiladi —
 * `entities/payments` ni butunlay mock qiluvchi testlar (`useCashBox` faqat) buzilmaydi.
 */

export const PAYMENT_CORRECTION_ACTIONS = ["reverse", "edit"] as const;
export type PaymentCorrectionAction = (typeof PAYMENT_CORRECTION_ACTIONS)[number];

export const PAYMENT_CORRECTION_ROLES = ["original", "reversal", "replacement"] as const;
export type PaymentCorrectionRole = (typeof PAYMENT_CORRECTION_ROLES)[number];

/** Teskari yozuvning manba turi (backend `Source_type.PAYMENT_REVERSAL`, faqat ichki — qo'lda yozib bo'lmaydi). */
export const PAYMENT_REVERSAL_SOURCE_TYPE = "payment_reversal";

/** «Bog'liq yozuv» — shu kassadagi juft oyoq. */
export interface PaymentCorrectionRelated {
  id: string;
  source_type: string;
  role: PaymentCorrectionRole;
  operation_type: "income" | "expense" | null;
  amount: number;
  created_at: string | null;
}

export interface PaymentCorrection {
  id: string;
  action: PaymentCorrectionAction;
  /** `courier_payment` | `market_payment` (click_to_market'ning MAIN `market_payment` oyog'ida ham `courier_payment`). */
  payment_kind: string | null;
  role: PaymentCorrectionRole;
  reason: string;
  /** Tuzatgan superadmin ismi; identity qidiruvi yiqilsa — `null`. */
  created_by_name: string | null;
  /** Tuzatish vaqti (ISO). */
  created_at: string | null;
  original_amount: number | null;
  /** `edit` — yangi summa; `reverse` — `null`. */
  new_amount: number | null;
  related_history_id: string | null;
  related: PaymentCorrectionRelated | null;
}

export type PaymentCorrectableCode =
  | "NOT_CORRECTABLE"
  | "LEGACY_UNLINKED"
  | "ALREADY_CORRECTED"
  | "WINDOW_EXPIRED"
  | "COURIER_MOVED";

/** Superadmin tafsilotidagi tuzatish imkoniyati (N2 — «Qaytarish» / «Summani tahrirlash»). */
export interface PaymentCorrectable {
  allowed: boolean;
  code?: PaymentCorrectableCode;
  reason?: "unsupported_type" | "reversal_row" | "cashbox_deleted";
  deadline: string | null;
  window_days: number;
  root_history_id: string | null;
}

/** Ro'yxat va oynadagi belgi: «Qaytarildi» · «Tahrirlangan» · «Teskari yozuv» · «Tuzatilgan». */
export type PaymentCorrectionBadgeKind = "reversed" | "edited" | "reversal" | "replacement";

// ───────────────────────── normalizator ─────────────────────────

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const amount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const oneOf = <T extends string>(values: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (values as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as T)
    : null;

const toRelated = (raw: unknown): PaymentCorrectionRelated | null => {
  const value = record(raw);
  const id = text(value?.id);
  const role = oneOf(PAYMENT_CORRECTION_ROLES, value?.role);
  if (!value || !id || !role) return null;
  const operation = typeof value.operation_type === "string" ? value.operation_type.trim().toLowerCase() : "";
  return {
    id,
    source_type: text(value.source_type)?.toLowerCase() ?? "",
    role,
    operation_type: operation === "income" || operation === "expense" ? operation : null,
    amount: Math.abs(amount(value.amount) ?? 0),
    created_at: text(value.created_at ?? value.createdAt),
  };
};

/**
 * Backend `correction` → `PaymentCorrection`. Himoyaviy: obyekt emas, noma'lum `role` yoki `action` — `null`
 * (belgi chizilmaydi); son satrlari → son; `related` alohida tekshiriladi (yaroqsiz — `null`).
 */
export const toPaymentCorrection = (raw: unknown): PaymentCorrection | null => {
  const value = record(raw);
  if (!value) return null;
  const role = oneOf(PAYMENT_CORRECTION_ROLES, value.role);
  const action = oneOf(PAYMENT_CORRECTION_ACTIONS, value.action);
  if (!role || !action) return null;
  const original = amount(value.original_amount);
  const next = amount(value.new_amount);
  return {
    id: text(value.id) ?? "",
    action,
    payment_kind: text(value.payment_kind)?.toLowerCase() ?? null,
    role,
    reason: typeof value.reason === "string" ? value.reason.trim() : "",
    created_by_name: text(value.created_by_name),
    created_at: text(value.created_at ?? value.createdAt),
    original_amount: original === null ? null : Math.abs(original),
    new_amount: next === null ? null : Math.abs(next),
    related_history_id: text(value.related_history_id),
    related: toRelated(value.related),
  };
};

/** Rol + amaldan belgi turi (bitta qatorga bitta belgi; backend ustuvorligi reversal → original → replacement). */
export const correctionBadgeKindOf = (
  role: PaymentCorrectionRole,
  action: PaymentCorrectionAction,
): PaymentCorrectionBadgeKind => {
  if (role === "reversal") return "reversal";
  if (role === "replacement") return "replacement";
  return action === "reverse" ? "reversed" : "edited";
};

const sourceTypeOf = (row: { source_type?: unknown }) =>
  typeof row.source_type === "string" ? row.source_type.trim().toLowerCase() : "";

/**
 * Qator belgisi: `correction` bo'yicha; `correction` kelmagan (backend qidiruvi yiqildi) teskari yozuv —
 * manba turidan («Teskari yozuv»). Tuzatilmagan qator — `null`.
 */
export const paymentCorrectionBadgeKind = (
  row: { correction?: unknown; source_type?: unknown } | null | undefined,
): PaymentCorrectionBadgeKind | null => {
  if (!row) return null;
  const correction = toPaymentCorrection(row.correction);
  if (correction) return correctionBadgeKindOf(correction.role, correction.action);
  return sourceTypeOf(row) === PAYMENT_REVERSAL_SOURCE_TYPE ? "reversal" : null;
};

/** Teskari yozuv qatori (`payment_reversal`, `reverses_history_id` yoki `correction.role = reversal`). */
export const isPaymentReversalRow = (
  row: { correction?: unknown; source_type?: unknown; reverses_history_id?: unknown } | null | undefined,
) =>
  Boolean(
    row &&
      (sourceTypeOf(row) === PAYMENT_REVERSAL_SOURCE_TYPE ||
        text(row.reverses_history_id) ||
        record(row.correction)?.role === "reversal"),
  );

type HistoryDateRow = {
  correction?: unknown;
  payment_date?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

/**
 * Tarix qatorining ko'rsatiladigan va saralanadigan vaqti (T6, ega qarori C1): tahrirdan keyingi yangi to'lov
 * («Tuzatilgan», `correction.role = replacement`) — tuzatish vaqti (`createdAt`; backend asl `payment_date` ni
 * nusxalaydi), qolganlari — `payment_date`, bo'lmasa `createdAt`. Backend keyinroq `payment_date` ni o'zi
 * to'g'rilasa ham natija o'zgarmaydi. Xom javob qatori ham, `PaymentRow` ham bo'ladi.
 */
export const historyRowDate = (row: HistoryDateRow | null | undefined): string => {
  if (!row) return "";
  const created = row.createdAt || row.created_at || "";
  if (record(row.correction)?.role === "replacement" && created) return created;
  return row.payment_date || created;
};
