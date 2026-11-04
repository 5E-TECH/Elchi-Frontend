/**
 * ALMASHTIRISH (kafolat bo'yicha almashtirish, lQjt6sKP) — buyurtma yozuvidagi almashtirish maydonlari.
 *
 * Backend (f443638a) buyurtmaning to'liq yozuvida beradi (`GET /orders`, `/orders/:id`, kuryer ro'yxati, skan):
 *  - YANGI (almashtirish) buyurtma: `replacement_of_order_id` — eski buyurtma id'si, `replacement_state`;
 *  - ESKI (qaytariladigan) buyurtma: `is_replacement_return: true`, `replacement_state`;
 *  - ikkalasida `old_item_collected_at` — kuryer «Eskisini oldim» deb sotgan payt.
 * Holatlar: `awaiting_old_pickup` (kuryer eskisini olishi kerak) → `old_collected` → `old_returned`.
 *
 * Sotish darvozasi (backend `assertReplacementSaleAllowed`): almashtirish buyurtmasi eski mahsulot olinmaguncha
 * (`old_collected` / `old_returned` emas — `null` ham «olinmagan») `oldItemCollected: true` siz sotilmaydi —
 * to'liq va qisman sotishda, kuryer va menejerda bir xil. Sotilgan almashtirish qaytarilsa (rollback) holat
 * `old_collected` qoladi — qayta sotishda tasdiq kerak emas.
 */

export type OrderReplacementState = "awaiting_old_pickup" | "old_collected" | "old_returned";

const REPLACEMENT_STATES: readonly string[] = ["awaiting_old_pickup", "old_collected", "old_returned"];

export interface OrderReplacementInfo {
  /** Yangi buyurtma — avval yetkazilgan buyurtma o'rniga yuborilgan. */
  isReplacement: boolean;
  /** Eski buyurtma — mahsuloti mijozdan qaytarib olinib, marketga qaytariladi. */
  isReplacementReturn: boolean;
  /** Yangi buyurtmada — eski buyurtmaning ichki id'si. */
  oldOrderId: string | null;
  state: OrderReplacementState | null;
  /** Eski mahsulot olingan payt (ISO yoki backend matni). */
  collectedAt: string | null;
  /** Sotishda «Eski mahsulotni oldim» tasdig'i SHART (backend darvozasi bilan aynan bir xil shart). */
  needsOldItemConfirm: boolean;
}

const asId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const asState = (value: unknown): OrderReplacementState | null =>
  typeof value === "string" && REPLACEMENT_STATES.includes(value) ? (value as OrderReplacementState) : null;

const asDate = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
};

/** Buyurtma (har qanday shakl) → almashtirish ma'lumoti; maydonlar yo'q bo'lsa — oddiy buyurtma. */
export const readOrderReplacement = (order: unknown): OrderReplacementInfo => {
  const source = (order && typeof order === "object" ? order : {}) as {
    replacement_of_order_id?: unknown;
    replacement_state?: unknown;
    is_replacement_return?: unknown;
    old_item_collected_at?: unknown;
  };
  const oldOrderId = asId(source.replacement_of_order_id);
  const state = asState(source.replacement_state);
  const isReplacement = oldOrderId !== null;

  return {
    isReplacement,
    isReplacementReturn: source.is_replacement_return === true,
    oldOrderId,
    state,
    collectedAt: asDate(source.old_item_collected_at),
    needsOldItemConfirm: isReplacement && state !== "old_collected" && state !== "old_returned",
  };
};

/** Backend `formatOrderNumber` qoidasi (`orderNumber.ts`): «EL-» + (id + 100000). */
const ORDER_NUMBER_OFFSET = 100_000;

/**
 * Eski buyurtmaning ekrandagi raqami — «№EL-100081». Almashtirish maydonida faqat ichki id keladi
 * (`order_number` yo'q), shuning uchun raqam id'dan hosil qilinadi; raqamsiz id — o'zgarmay («№abc»).
 */
export const formatReplacementOrderRef = (orderId: string | number): string => {
  const id = String(orderId).trim();
  const numeric = /^\d{1,15}$/.test(id) ? Number(id) + ORDER_NUMBER_OFFSET : null;
  return `№${numeric !== null && Number.isSafeInteger(numeric) ? `EL-${numeric}` : id}`;
};
