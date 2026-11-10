import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * «QABUL VA YARATISH → BEKOR QILINGANLAR → TOPSHIRILGAN» (2026-11-10).
 *
 * Partiya — HQ xodimining BITTA «Marketga jo'natish» bosishi (bitta karta). Backend:
 *  - `GET orders/markets/cancelled/handovers` (`search`, `start_day`, `end_day`, `page`, `limit` 12/24/48) →
 *    `{ data: HandoverBatch[], total, page, limit, totals: { batches, orders, amount }, total_pages, … }`;
 *  - `GET orders/markets/cancelled/handovers/:batchId` → `{ batch, data: buyurtmalar, total }`.
 *
 * Kalit `["orders", "markets", "cancelled", "handovers", …]`: «Marketga jo'natish» `["orders"]` ni yangilaydi — yangi
 * karta o'zi chiqadi.
 */

export const HANDOVER_BATCH_PAGE_LIMITS = [12, 24, 48] as const;
export const HANDOVER_BATCH_DEFAULT_LIMIT = 24;

export type HandoverBatchMethod = "qr" | "pin" | "no_qr" | "manual";

export type HandoverBatch = {
  id: string;
  market_id: string;
  market: { id: string; name: string | null; phone_number: string | null } | null;
  /** ISO vaqt. */
  handed_at: string;
  /** Toshkent kuni `YYYY-MM-DD` (serverdan — kun sarlavhasi). */
  day: string;
  handed_by: { id: string; name: string | null } | null;
  /** Qo'lda bo'lmaganlarning usuli; hammasi qo'lda — `manual`; eski partiyada `null`. */
  method: HandoverBatchMethod | null;
  /** QR buzilgani uchun qo'lda tasdiqlanganlar soni. */
  manual_count: number;
  orders_count: number;
  total_price_sum: number;
};

export type HandoverBatchesTotals = { batches: number; orders: number; amount: number };

export type HandoverBatchesPage = {
  items: HandoverBatch[];
  total: number;
  totals: HandoverBatchesTotals;
};

export type HandoverBatchDetail = {
  batch: HandoverBatch | null;
  /** Buyurtmalar (`GET /orders` qatori kabi) — sahifa o'zi o'giradi. */
  orders: unknown[];
};

export type HandoverBatchesParams = {
  search?: string;
  start_day?: string;
  end_day?: string;
  page: number;
  limit: number;
};

const METHODS = new Set<HandoverBatchMethod>(["qr", "pin", "no_qr", "manual"]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown): string | null =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : null;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Bitta karta; `id` / vaqti yo'q yozuv — `null` (tashlab yuboriladi). */
export const parseHandoverBatch = (value: unknown): HandoverBatch | null => {
  const row = asRecord(value);
  const id = text(row?.id);
  const handedAt = text(row?.handed_at);
  if (!row || !id || !handedAt || Number.isNaN(Date.parse(handedAt))) return null;
  const market = asRecord(row.market);
  const handedBy = asRecord(row.handed_by);
  const method = text(row.method) as HandoverBatchMethod | null;
  const marketId = text(row.market_id) ?? text(market?.id) ?? "";
  return {
    id,
    market_id: marketId,
    market: market
      ? { id: text(market.id) ?? marketId, name: text(market.name), phone_number: text(market.phone_number) }
      : null,
    handed_at: handedAt,
    day: text(row.day) ?? "",
    handed_by: handedBy && text(handedBy.id) ? { id: text(handedBy.id)!, name: text(handedBy.name) } : null,
    method: method && METHODS.has(method) ? method : null,
    manual_count: toNumber(row.manual_count),
    orders_count: toNumber(row.orders_count),
    total_price_sum: toNumber(row.total_price_sum),
  };
};

/** Ro'yxat javobi; `totals` kelmasa — sahifadagi kartalardan (eski backend / qisman javob). */
export const parseHandoverBatchesPage = (body: unknown): HandoverBatchesPage => {
  const source = asRecord(body);
  const items = (Array.isArray(source?.data) ? source.data : Array.isArray(body) ? body : [])
    .map(parseHandoverBatch)
    .filter((item): item is HandoverBatch => item !== null);
  const rawTotals = asRecord(source?.totals);
  const total = source && source.total !== undefined ? toNumber(source.total) : items.length;
  return {
    items,
    total,
    totals: rawTotals
      ? {
          batches: toNumber(rawTotals.batches),
          orders: toNumber(rawTotals.orders),
          amount: toNumber(rawTotals.amount),
        }
      : {
          batches: total,
          orders: items.reduce((sum, item) => sum + item.orders_count, 0),
          amount: items.reduce((sum, item) => sum + item.total_price_sum, 0),
        },
  };
};

export const parseHandoverBatchDetail = (body: unknown): HandoverBatchDetail => {
  const source = asRecord(body);
  return {
    batch: parseHandoverBatch(source?.batch),
    orders: Array.isArray(source?.data) ? source.data : [],
  };
};

const cleanParams = (params: HandoverBatchesParams) => {
  const query: Record<string, string | number> = { page: params.page, limit: params.limit };
  const search = params.search?.trim();
  if (search) query.search = search;
  if (params.start_day) query.start_day = params.start_day;
  if (params.end_day) query.end_day = params.end_day;
  return query;
};

export const cancelledHandoverKeys = {
  all: ["orders", "markets", "cancelled", "handovers"] as const,
  list: (params: Record<string, string | number>) => [...cancelledHandoverKeys.all, "list", params] as const,
  batch: (batchId: string) => [...cancelledHandoverKeys.all, "batch", batchId] as const,
};

/** «Topshirilgan» kartalari (sahifalangan). Tab soni ham shu so'rovdan — kalit umumiy. */
export const useCancelledHandovers = (params: HandoverBatchesParams, options?: { enabled?: boolean }) => {
  const query = cleanParams(params);
  return useQuery({
    queryKey: cancelledHandoverKeys.list(query),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED_HANDOVERS, { params: query })
        .then((res) => parseHandoverBatchesPage(res.data)),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
};

/**
 * Bitta karta va uning buyurtmalari. Global xato xabari yo'q (`silentError`): sahifa xatoni o'zi ko'rsatadi
 * («Topshirish topilmadi» yoki «Qayta urinish»).
 */
export const useCancelledHandoverBatch = (batchId: string) =>
  useQuery({
    queryKey: cancelledHandoverKeys.batch(batchId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED_HANDOVER_BATCH(batchId))
        .then((res) => parseHandoverBatchDetail(res.data)),
    enabled: Boolean(batchId),
    meta: { silentError: true },
  });
