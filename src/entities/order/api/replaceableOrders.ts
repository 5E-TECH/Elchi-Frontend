import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { orderIdFromSearch } from "../model/orderNumber";
import { ORDER_KEY } from "./orderApi";

/**
 * ALMASHTIRISH UCHUN ESKI BUYURTMALAR (lQjt6sKP) — `GET orders/replaceable`. Yaratish formasi yangi buyurtmani avval
 * YETKAZILGAN buyurtma o'rniga yuboradi (`POST /orders` → `replaced_order_id`); backend ro'yxatda faqat shu marketning
 * `sold` / `paid` / `partly_paid` va hali almashtirilmagan buyurtmalarini beradi.
 *
 * Doira backend'da: market va market operatori — tokendan (`market_id` yuborilmaydi), boshqa rollar — `market_id`
 * majburiy. `q`: 1–6 raqam — buyurtma ID; telefon (7–15 raqam) — shu marketdagi mijoz; boshqa matn — izoh yoki
 * mahsulot nomi. `customer_id` va `q` birga — VA. Ikkalasi ham bo'lmasa — marketning hamma almashtiriladigan
 * buyurtmalari (eng yangi yetkazilgani birinchi).
 *
 * Kalit `["orders", "replaceable", params]` — `POST /orders` va sotuvdagi `["orders"]` yangilanishi buni ham yangilaydi
 * (tanlangan eski buyurtma ro'yxatdan chiqadi).
 */

export interface ReplaceableOrdersParams {
  market_id?: string;
  customer_id?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ReplaceableOrderItem {
  product_id: string | null;
  product_name: string | null;
  quantity: number;
}

export interface ReplaceableOrderRow {
  id: string;
  /** `sold` | `paid` | `partly_paid`. */
  status: string;
  market_id: string | null;
  customer_id: string | null;
  customer: { id: string | null; name: string | null; phone_number: string | null } | null;
  total_price: number;
  where_deliver: string | null;
  comment: string | null;
  /** Yetkazilgan (sotilgan) payt — epoch millisekund matni («1729000000000») yoki `null`. */
  sold_at: string | null;
  createdAt: string | null;
  items: ReplaceableOrderItem[];
}

export interface ReplaceableOrdersPage {
  items: ReplaceableOrderRow[];
  total: number;
  page: number;
  limit: number;
}

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const amount = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Gateway qobig'i `{ statusCode, message, data }` yoki to'g'ridan-to'g'ri qiymat. */
const unwrap = (payload: unknown): unknown =>
  payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : payload;

const toRow = (row: Record<string, unknown>): ReplaceableOrderRow => {
  const customer = row.customer && typeof row.customer === "object" ? (row.customer as Record<string, unknown>) : null;
  return {
    id: text(row.id) ?? "",
    status: text(row.status) ?? "",
    market_id: text(row.market_id),
    customer_id: text(row.customer_id),
    customer: customer
      ? { id: text(customer.id), name: text(customer.name), phone_number: text(customer.phone_number) }
      : null,
    total_price: amount(row.total_price),
    where_deliver: text(row.where_deliver),
    comment: text(row.comment),
    sold_at: text(row.sold_at),
    createdAt: text(row.createdAt),
    items: (Array.isArray(row.items) ? row.items : [])
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        product_id: text(item.product_id),
        product_name: text(item.product_name),
        quantity: amount(item.quantity),
      })),
  };
};

/** Javob → sahifa (noto'g'ri qatorlar tashlanadi, maydonlar oq ro'yxatda). */
export const toReplaceableOrdersPage = (payload: unknown): ReplaceableOrdersPage => {
  const data = unwrap(payload);
  const record = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const list = Array.isArray(data) ? data : Array.isArray(record.items) ? record.items : [];
  const items = list
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map(toRow)
    .filter((row) => row.id !== "");
  return {
    items,
    total: Math.max(amount(record.total, items.length), items.length),
    page: amount(record.page, 1),
    limit: amount(record.limit, items.length),
  };
};

/**
 * Qidiruv matni → backend `q`. Ko'rinadigan raqam («EL-100081», «№EL-100081») — ichki id («81»): backend «EL-…» ni
 * tushunmaydi (matn qidiruvi bo'lib, hech narsa topmaydi). «#81» / «№81» — «81». Qolgani (telefon, matn) o'zgarmaydi.
 */
export const toReplaceableSearch = (search: string): string => {
  const value = search.trim();
  const fromNumber = orderIdFromSearch(value);
  if (fromNumber) return fromNumber;
  const plainId = /^[#№]\s*(\d{1,18})$/u.exec(value);
  return plainId ? plainId[1] : value;
};

export const replaceableOrdersQueryKey = (params: ReplaceableOrdersParams) =>
  [ORDER_KEY, "replaceable", params] as const;

export const fetchReplaceableOrders = (params: ReplaceableOrdersParams) =>
  api
    .get(API_ENDPOINTS.ORDERS.REPLACEABLE, { params })
    .then((res) => toReplaceableOrdersPage(res.data));

/**
 * Almashtiriladigan buyurtmalar. `enabled` — tanlash oynasi ochiq va market ma'lum. Xato umumiy bildirishnoma
 * bermaydi — oyna o'zi «Qayta urinish» bilan ko'rsatadi (tanlov ixtiyoriy, forma ishlayveradi).
 */
export const useReplaceableOrders = (params: ReplaceableOrdersParams, enabled: boolean) =>
  useQuery({
    queryKey: replaceableOrdersQueryKey(params),
    queryFn: () => fetchReplaceableOrders(params),
    enabled,
    staleTime: 30_000,
    retry: false,
    meta: { silentError: true },
  });
