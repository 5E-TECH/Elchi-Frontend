/**
 * `POST /orders/ai-parse` RASM CHEGARALARI — backend `libs/common/src/ai/order-extract.contract.ts`
 * (`AI_MAX_IMAGES`, `AI_IMAGE_MAX_BYTES`, `AI_IMAGES_TOTAL_MAX_BYTES`) bilan AYNAN bir xil (WHMAIqyo, 2026-10-26).
 * Frontend shu chegaralarni yuborishdan OLDIN tekshiradi — server 400 i faqat zaxira.
 */
export const AI_MAX_IMAGES = 20;
/** Bitta (kichraytirilgan) rasm — 1,5 MB. */
export const AI_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
/** Bitta so'rovdagi rasmlar jami — 20 MB. */
export const AI_IMAGES_TOTAL_MAX_BYTES = 20 * 1024 * 1024;
