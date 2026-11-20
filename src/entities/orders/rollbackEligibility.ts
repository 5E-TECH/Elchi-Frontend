/**
 * BUYURTMANI QAYTARISH RUXSATI (BE #738, ega qarorlari D1–D4, 2026-11-19).
 *
 * `GET /orders` (hamma tablar va rollar), `GET /orders/:id` va kuryer ro'yxatlari har buyurtmada joriy foydalanuvchi
 * uchun `rollback: { allowed, code, message }` beradi — `POST /orders/rollback/:id` bilan AYNI qaror funksiyasi
 * (`evaluateRollbackEligibility`). Shuning uchun «Qaytarish» tugmasi faqat shu maydondan chiziladi: holat, rol,
 * filial turi yoki `can_sell_cancel` ga qarab FE o'zi hisoblamaydi.
 *
 * `rollback: null` yoki maydon umuman yo'q — noma'lum (order-service 1.5 s da ulgurmadi yoki eski backend). Shunda
 * sahifaning avvalgi (mijoz tomoni) qoidasi zaxira bo'lib ishlaydi va qarorni endpoint beradi (rad etsa — oynada
 * sabab).
 */

import type { OrderRollbackEligibility } from "../order/types/order";

/** Ro'yxat / tafsilotdagi `rollback` maydoni (OpenAPI `OrderRollbackEligibilityDto`). */
export type { OrderRollbackEligibility };

/** Backend rad etish kodlari (ro'yxat maydoni va endpoint; `STATE_CHANGED`, `INVALID_TARGET` — faqat endpoint). */
export const ROLLBACK_CODES = {
  NOT_ALLOWED_ROLE: "NOT_ALLOWED_ROLE",
  STATUS_NOT_ROLLBACKABLE: "STATUS_NOT_ROLLBACKABLE",
  NO_SALE_RECORD: "NO_SALE_RECORD",
  NO_PERMISSION: "NO_PERMISSION",
  NOT_OWN_BRANCH: "NOT_OWN_BRANCH",
  NOT_OWN_ORDER: "NOT_OWN_ORDER",
  PARCEL_NOT_IN_BRANCH: "PARCEL_NOT_IN_BRANCH",
  SUPERADMIN_ONLY: "SUPERADMIN_ONLY",
  COURIER_REMITTED: "COURIER_REMITTED",
  CORRECTION_REQUIRED: "CORRECTION_REQUIRED",
  STATE_CHANGED: "STATE_CHANGED",
  INVALID_TARGET: "INVALID_TARGET",
} as const;

/**
 * Sababi ko'rsatilmaydigan kodlar: rol umuman qaytara olmaydi (admin, registrator, market …) yoki buyurtma holati
 * qaytariladigan holat emas (kutilmoqda, yo'lda …) — bunday qatorda «nega yo'q» degan savol tug'ilmaydi, sabab
 * har sahifada shovqin bo'lardi.
 */
const SILENT_CODES = new Set<string>([ROLLBACK_CODES.NOT_ALLOWED_ROLE, ROLLBACK_CODES.STATUS_NOT_ROLLBACKABLE]);

const pickText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Buyurtmadagi `rollback` maydoni. `null` — noma'lum: maydon yo'q, `null` yoki shakli boshqacha (`allowed` boolean
 * emas) — chaqiruvchi zaxira qoidaga o'tadi.
 */
export const readRollbackEligibility = (order: unknown): OrderRollbackEligibility | null => {
  if (!order || typeof order !== "object") return null;
  const raw = (order as { rollback?: unknown }).rollback;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as { allowed?: unknown; code?: unknown; message?: unknown };
  if (typeof record.allowed !== "boolean") return null;
  return { allowed: record.allowed, code: pickText(record.code), message: pickText(record.message) };
};

/** Ruxsat yo'q bo'lsa ko'rsatiladigan sabab (`message`); ruxsat bor, noma'lum yoki «jim» kod — `null`. */
export const getRollbackBlockReason = (eligibility: OrderRollbackEligibility | null): string | null => {
  if (!eligibility || eligibility.allowed) return null;
  if (eligibility.code && SILENT_CODES.has(eligibility.code)) return null;
  return eligibility.message;
};

export type RollbackAvailability = {
  /** «Qaytarish» amali ko'rsatiladimi. */
  allowed: boolean;
  /** Ruxsat yo'qligining server sababi (ko'rsatish uchun) — faqat maydon bor va «jim» bo'lmagan kodda. */
  reason: string | null;
  /** `server` — maydondan; `fallback` — maydon yo'q / `null`, sahifaning eski qoidasi. */
  source: "server" | "fallback";
};

/**
 * Qatordagi / sahifadagi «Qaytarish»: maydon bor bo'lsa — faqat `rollback.allowed` (eski FE shartlari — filial turi,
 * `can_sell_cancel`, holat — e'tiborsiz); maydon noma'lum bo'lsa — `fallback()` (sahifaning avvalgi qoidasi).
 */
export const resolveRollbackAvailability = (order: unknown, fallback: () => boolean): RollbackAvailability => {
  const eligibility = readRollbackEligibility(order);
  if (eligibility) {
    const reason = hasRollbackReasonStatus(order) ? getRollbackBlockReason(eligibility) : null;
    return { allowed: eligibility.allowed, reason, source: "server" };
  }
  return { allowed: fallback(), reason: null, source: "fallback" };
};

const normalizeText = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim().toLowerCase().replaceAll("_", " ").replace("canceled", "cancelled")
    : "";

/**
 * Sabab faqat qaytarish savoli tug'iladigan holatlarda ko'rsatiladi: sotilgan, bekor qilingan (jo'natilgani ham),
 * to'langan va qisman to'langan. Yopilgan, marketga qaytarilgan va boshqa holatlarda «Qaytarish yopiq» izohi shovqin.
 */
const ROLLBACK_REASON_STATUSES = new Set(["sold", "cancelled", "cancelled (sent)", "paid", "partly paid"]);

const hasRollbackReasonStatus = (order: unknown): boolean => {
  if (!order || typeof order !== "object") return false;
  return ROLLBACK_REASON_STATUSES.has(normalizeText((order as { status?: unknown }).status));
};

/**
 * Bekor posilka jo'natilgan: `cancelled (sent)` holati yoki gateway ko'rinishi — `status: cancelled` +
 * `transport_status: "cancelled (sent)"` (kuryer va menejer ro'yxatlari). Bunday buyurtmani menejer ham, kuryer ham,
 * superadmin ham qaytara olmaydi (backend `PARCEL_NOT_IN_BRANCH` / `STATUS_NOT_ROLLBACKABLE`) — zaxira qoidasida
 * tugma chiqmaydi (avval chiqib, bosilganda doim rad etilardi).
 */
export const isCancelledSentOrder = (order: unknown): boolean => {
  if (!order || typeof order !== "object") return false;
  const record = order as { status?: unknown; transport_status?: unknown; transportStatus?: unknown };
  return (
    normalizeText(record.status) === "cancelled (sent)" ||
    normalizeText(record.transport_status ?? record.transportStatus) === "cancelled (sent)"
  );
};

/**
 * Bekor posilka bekorlar pochtasiga solingan (`canceled_post_id`, S11) — holati hali `cancelled` bo'lsa ham menejer
 * va kuryer qaytara olmaydi (`PARCEL_NOT_IN_BRANCH`). Superadminni cheklamaydi.
 */
export const hasCancelPost = (order: unknown): boolean => {
  if (!order || typeof order !== "object") return false;
  const record = order as { canceled_post_id?: unknown; canceledPostId?: unknown };
  const id = record.canceled_post_id ?? record.canceledPostId;
  return (typeof id === "string" || typeof id === "number") && String(id).trim() !== "" && String(id).trim() !== "0";
};
