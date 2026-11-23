import type { PostOrder } from "../../../../entities/mails";

/**
 * Pochta tafsilotidagi skaner va zaxira ro'yxat yordamchilari (sahifadan ko'chirildi, mantiq o'zgarmagan).
 *
 *  - `unwrapScannedOrder` — QR skan javobidan buyurtma yozuvi. Ro'yxat bilan moslash — faqat aniq
 *    (`shared/lib/scanner/exactScanMatch`); «o'xshash» (bir xil mijoz + market) moslik olib tashlandi — u BOSHQA
 *    buyurtmani tanlardi (skan auditi 2026-11-23, #46);
 *  - `extractOrderItems` — `GET orders` javobining turli shakllari (viloyat zaxirasi, fix3);
 *  - holat to'plamlari: bugungi pochta buyurtmalari va rad etilgan pochta buyurtmalari.
 */
export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

export const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

export const unwrapScannedOrder = (payload: unknown) => {
  const source = asRecord(payload);
  const data = asRecord(source.data ?? source);
  const nestedData = asRecord(data.data ?? data);
  return asRecord(nestedData.order ?? data.order ?? nestedData);
};

export const extractOrderItems = (payload: unknown): PostOrder[] => {
  const response = payload as
    | PostOrder[]
    | {
      data?: PostOrder[] | { items?: PostOrder[]; data?: PostOrder[] };
      items?: PostOrder[];
    };

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.items)) return response.data.items;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

export const TODAY_MAIL_ORDER_STATUSES = new Set(["on the road", "new", "received", "waiting"]);
export const REFUSED_MAIL_ORDER_STATUSES = new Set(["cancelled", "cancelled (sent)", "canceled", "canceled (sent)", "rejected"]);
