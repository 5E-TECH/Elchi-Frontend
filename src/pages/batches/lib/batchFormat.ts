/**
 * Paket raqami yordamchisi. QR — ilova ichida (`features/print-receipts` → `ReceiptQr`, HJ5sLHiz). Pul, sana, holat
 * yorlig'i va toni — umumiy formatlovchilar (`formatMoneyLocalized`, `formatDateTimeLocalized`), `BATCH_STATUS_TONE`
 * (`entities/batch`) va `newOrders:batchStatus.*` orqali (v1 dagi o'z formatlovchilari va rang xaritalari olib
 * tashlandi).
 */

/** «148» → «B-148» (allaqachon «B-» bilan bo'lsa — o'zi). */
export const formatBatchDisplayId = (value: string | number) => {
  const id = String(value);
  return id.startsWith("B-") ? id : `B-${id}`;
};
