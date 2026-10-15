/**
 * BEKOR QILISH SABABI — yopiq ro'yxat (GNWDKvmZ / PUvKXWVw).
 *
 * Backend `POST /orders/cancel/:id` da `reason` majburiy (bo'sh — 400) va
 * `return_reason` ustuniga yoziladi; `OTHER` bo'lsa izoh (`comment`) ham
 * majburiy. Sabablar hisoboti shu qiymatlar bo'yicha guruhlanadi.
 */
export const CANCEL_REASONS = [
  "CUSTOMER_NO_ANSWER",
  "CUSTOMER_REFUSED",
  "WRONG_ADDRESS",
  "DEFECTIVE_PRODUCT",
  "PRICE_DISPUTE",
  "OTHER",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

/** `OTHER` da izohsiz yuborib bo'lmaydi. */
export const cancelReasonNeedsComment = (reason: CancelReason | "") => reason === "OTHER";

/** Yuborishga tayyormi: sabab tanlangan va (`OTHER` bo'lsa) izoh yozilgan. */
export const isCancelReasonComplete = (reason: CancelReason | "", comment: string) =>
  reason !== "" && (!cancelReasonNeedsComment(reason) || comment.trim().length > 0);

/**
 * `POST /orders/cancel/:id` tanasi (isbot fayli yuklangach `proofFileKeys` ga aylanadi).
 * Bekor qilish oynasi `reason` ni DOIM yuboradi. Ommaviy yakunlash
 * (`courier-bulk`) sababsiz, faqat izoh bilan yuboradi — backend uni `OTHER`
 * deb yozadi.
 */
export type CancelOrderPayload = {
  reason?: CancelReason;
  comment: string;
  extraCost: number;
  proof?: File;
};
