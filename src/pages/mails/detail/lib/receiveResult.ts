const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toId = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/**
 * PATCH /post/receive/:id javobidagi qabul qilinmagan buyurtmalar (fix3b LC-11).
 *
 * Backend `data` shaklini o'zgartirmagan (qabul qilingan buyurtmalar
 * ro'yxati), yuqori darajada esa `not_received_order_ids: string[]` va
 * `failures: [{ order_id, error }]` qaytaradi. `not_received_order_ids` —
 * tanlangan, lekin WAITING ga o'tmay hamon yo'lda qolgan buyurtmalar: ular
 * "qabul qilindi" deb yashirilmasligi kerak. (`failures` ga tanlanmagan
 * qatorlarning yon yangilanishlari ham kiradi — u bu yerda ishlatilmaydi.)
 */
export const extractNotReceivedOrderIds = (response: unknown): string[] => {
  const body = asRecord(response);
  const raw = body.not_received_order_ids ?? asRecord(body.data).not_received_order_ids;
  if (!Array.isArray(raw)) return [];

  return [...new Set(raw.map(toId).filter(Boolean))];
};

/**
 * "Eski" (qabul qilingan) pochtada hamon yo'lda (ON_THE_ROAD) buyurtma bormi
 * (fix3b LC-11). Eski yozuvlarda pochta RECEIVED bo'lib qolgan, ichida esa
 * qabul qilinmagan posilka bor — u holda qabul qilish qayta ochiladi.
 */
export const hasOnTheRoadOrders = (orders: ReadonlyArray<{ status?: string | null }>) =>
  orders.some((order) => order.status === "on the road");
