import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { OrderReplacementState } from "../model/orderReplacement";
import { ORDER_KEY } from "./orderApi";

/**
 * ALMASHTIRISH QAYTARMALARI (lQjt6sKP) — `GET orders/replacement/returns`. Almashtirishga tanlangan ESKI (yetkazilgan)
 * buyurtmalar: mahsuloti mijozdan qaytarib olinib marketga qaytariladi. Har qatorda — eski buyurtma, uning o'rniga
 * ketgan yangi buyurtma (`replacement_order_id`, holati) va almashtirish holati (`replacement_state`).
 *
 * Doira backend'da: market — faqat o'zinikilar (token, `market_id` e'tiborsiz); superadmin va admin — hamma marketlar
 * yoki `market_id` bilan bittasi. `state` — `awaiting_old_pickup` | `old_collected` | `old_returned`. Tartib —
 * `updatedAt` kamayish bo'yicha, `limit` ko'pi bilan 100. Faqat o'qish: backend'da «Marketga topshirildi» amali yo'q.
 *
 * Kalit `["orders", "replacement-returns", params]` — yaratish va sotishdagi `["orders"]` yangilanishi buni ham
 * yangilaydi (yangi almashtirish qo'shiladi, kuryer «Eskisini oldim» deb sotsa holat o'zgaradi).
 */

export type ReplacementReturnState = OrderReplacementState;

export const REPLACEMENT_RETURN_STATES: readonly ReplacementReturnState[] = [
  "awaiting_old_pickup",
  "old_collected",
  "old_returned",
];

export interface ReplacementReturnsParams {
  market_id?: string;
  state?: ReplacementReturnState;
  page?: number;
  limit?: number;
}

export interface ReplacementReturnItem {
  product_id: string | null;
  product_name: string | null;
  quantity: number;
}

export interface ReplacementReturnPerson {
  id: string | null;
  name: string | null;
  phone_number: string | null;
}

export interface ReplacementReturnRow {
  /** Eski (almashtirilayotgan) buyurtma id'si. */
  id: string;
  /** Eski buyurtma holati — `sold` | `paid` | `partly_paid`. */
  status: string;
  market_id: string | null;
  customer: ReplacementReturnPerson | null;
  total_price: number;
  /** Eski buyurtma yetkazilgan payt — ISO (backend epoch-millisekund matnini beradi, shu yerda ISO ga aylanadi). */
  sold_at: string | null;
  createdAt: string | null;
  items: ReplacementReturnItem[];
  replacement_state: ReplacementReturnState | null;
  /** Kuryer «Eskisini oldim» deb sotgan payt (ISO). */
  old_item_collected_at: string | null;
  /** O'rniga ketgan yangi buyurtma; `null` — yangi buyurtma o'chirilgan. */
  replacement_order_id: string | null;
  replacement_order_status: string | null;
}

export interface ReplacementReturnsPage {
  items: ReplacementReturnRow[];
  total: number;
  page: number;
  limit: number;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const amount = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Sana: epoch-millisekund (son yoki raqamli matn) → ISO; boshqa matn (ISO) — o'zgarmaydi. */
const isoDate = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{10,15}$/.test(raw)) {
    const date = new Date(Number(raw));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return raw;
};

const asState = (value: unknown): ReplacementReturnState | null =>
  typeof value === "string" && (REPLACEMENT_RETURN_STATES as readonly string[]).includes(value)
    ? (value as ReplacementReturnState)
    : null;

const toPerson = (value: unknown): ReplacementReturnPerson | null => {
  const record = asRecord(value);
  return record
    ? { id: text(record.id), name: text(record.name), phone_number: text(record.phone_number) }
    : null;
};

const toRow = (row: UnknownRecord): ReplacementReturnRow => ({
  id: text(row.id) ?? "",
  status: text(row.status) ?? "",
  market_id: text(row.market_id),
  customer: toPerson(row.customer),
  total_price: amount(row.total_price),
  sold_at: isoDate(row.sold_at),
  createdAt: isoDate(row.createdAt),
  items: (Array.isArray(row.items) ? row.items : [])
    .map(asRecord)
    .filter((item): item is UnknownRecord => item !== null)
    .map((item) => ({
      product_id: text(item.product_id),
      product_name: text(item.product_name),
      quantity: amount(item.quantity),
    })),
  replacement_state: asState(row.replacement_state),
  old_item_collected_at: isoDate(row.old_item_collected_at),
  replacement_order_id: text(row.replacement_order_id),
  replacement_order_status: text(row.replacement_order_status),
});

/** Javob (`{ statusCode, data: { items, total, page, limit } }` yoki to'g'ridan-to'g'ri qiymat) → sahifa. */
export const toReplacementReturnsPage = (payload: unknown): ReplacementReturnsPage => {
  const root = asRecord(payload);
  const data = root && "data" in root ? root.data : payload;
  const record = asRecord(data) ?? {};
  const list = Array.isArray(data) ? data : Array.isArray(record.items) ? record.items : [];
  const items = list
    .map(asRecord)
    .filter((row): row is UnknownRecord => row !== null)
    .map(toRow)
    .filter((row) => row.id !== "");
  return {
    items,
    total: Math.max(amount(record.total, items.length), items.length),
    page: Math.max(1, amount(record.page, 1)),
    limit: Math.max(1, amount(record.limit, items.length || 20)),
  };
};

export const replacementReturnsQueryKey = (params: ReplacementReturnsParams) =>
  [ORDER_KEY, "replacement-returns", params] as const;

/** Ro'yxat; filtr yoki sahifa almashganda oldingi qatorlar ko'rinib turadi. */
export const useReplacementReturns = (params: ReplacementReturnsParams, enabled = true) =>
  useQuery({
    queryKey: replacementReturnsQueryKey(params),
    queryFn: async () =>
      toReplacementReturnsPage((await api.get(API_ENDPOINTS.ORDERS.REPLACEMENT_RETURNS, { params })).data),
    enabled,
    placeholderData: keepPreviousData,
  });
