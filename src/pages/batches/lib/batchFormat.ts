/**
 * Paket raqami va QR yordamchilari. Pul, sana, holat yorlig'i va toni — umumiy formatlovchilar
 * (`formatMoneyLocalized`, `formatDateTimeLocalized`), `BATCH_STATUS_TONE` (`entities/batch`) va
 * `newOrders:batchStatus.*` orqali (v1 dagi o'z formatlovchilari va rang xaritalari olib tashlandi).
 */

/** «148» → «B-148» (allaqachon «B-» bilan bo'lsa — o'zi). */
export const formatBatchDisplayId = (value: string | number) => {
  const id = String(value);
  return id.startsWith("B-") ? id : `B-${id}`;
};

/** Paket QR rasmi (`api.qrserver.com`, 320 × 320, chekkasiz). */
export const getBatchQrUrl = (token: string) => {
  const normalizedToken = token.trim();
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(normalizedToken)}`;
};
