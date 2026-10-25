/**
 * MIJOZGA KO'RINADIGAN BUYURTMA RAQAMI (rwAy8Qyk). Backend har buyurtma javobida (`enrichOrders`) `order_number`
 * beradi — «EL-» + (id + 100000), masalan id 81 → «EL-100081». Yorliq va chekda shu raqam chiqadi
 * (`printLabelPdf`), shuning uchun ro'yxat va tafsilot ham shuni ko'rsatadi — yorliqdagi raqamni qator bilan
 * moslab bo'ladi. Ichki `id` havolalarda (`/orders/edit/:id`) va API'da qoladi.
 *
 * `order_number` yo'q yoki bo'sh (eski / boyitilmagan javob) — zaxira ichki `id`.
 */

type OrderNumberSource = { id: string | number; order_number?: unknown } | null | undefined;

/** «EL-100081» (oldidagi «#» / «№» olib tashlanadi); zaxira — `id`. Nusxalashda shu matn ketadi. */
export const orderNumberOf = (order: OrderNumberSource, fallbackId?: string | number): string => {
  const raw = order?.order_number;
  const value = typeof raw === "string" ? raw.trim().replace(/^[#№]\s*/u, "") : "";
  if (value) return value;
  return String(order?.id ?? fallbackId ?? "");
};

/** Ekrandagi ko'rinishi: «№EL-100081» (zaxira «№81»). */
export const formatOrderRef = (order: OrderNumberSource, fallbackId?: string | number): string =>
  `№${orderNumberOf(order, fallbackId)}`;

/** Backend `formatOrderNumber`: «EL-» + (id + 100000) — deterministik, id'dan hosil qilinadi (migratsiyasiz). */
const ORDER_NUMBER_OFFSET = 100_000;
const ORDER_NUMBER_SEARCH = /^[#№]?\s*EL[-\s]?(\d{6,15})$/iu;

/**
 * Qidiruv matni: ko'rinadigan raqam («EL-100081», «#EL-100081», «№EL-100081») — ichki id («81»). Backend qidiruvi
 * hozircha faqat id raqamini oladi (`parseOrderNumberSearch`, FoCaUF10) — ro'yxatdan nusxalangan raqam qidiruvga
 * qo'yilsa ham buyurtma topilsin. Boshqa matn o'zgarmaydi.
 */
export const toOrderSearchTerm = (search: string): string => {
  const match = ORDER_NUMBER_SEARCH.exec(search.trim());
  if (!match) return search;
  const id = Number(match[1]) - ORDER_NUMBER_OFFSET;
  return Number.isSafeInteger(id) && id > 0 ? String(id) : search;
};
