import { toLocalPhone, toQuantity, type AiPreviewOrder } from "../../../../../entities/ai-order";

/**
 * BUYURTMA IMZOSI — bitta buyurtma ikki marta yaratilmasligi uchun.
 *
 * `telefon9 | mahsulot:son (saralangan) | narx`. Operator o'sha matnni qayta
 * tahlil qilsa, allaqachon yaratilgan buyurtma preview'ga qaytib kelmaydi.
 *
 * ⚠️ Katalogda yo'q (erkin matnli) mahsulotda `product_id` bo'sh — shuning
 * uchun uning o'rniga NOMI olinadi. Aks holda bir xil telefon va narxli,
 * lekin boshqa mahsulotli ikkinchi buyurtma "allaqachon yaratilgan" deb
 * jimgina tashlab yuborilardi.
 */
export const previewSig = (order: AiPreviewOrder): string => {
  const items = order.items
    .map((item) => `${item.product_id || item.name.trim().toLowerCase()}:${toQuantity(item.quantity)}`)
    .sort()
    .join(",");
  const price = order.total_price === null ? "" : String(Number(order.total_price));

  return `${toLocalPhone(order.phone_number)}|${items}|${price}`;
};
