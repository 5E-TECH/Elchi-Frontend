import { useMemo } from "react";
import { useOrders } from "../../../entities/orders";
import type { OrderListItem } from "../../../entities/order/types/order";
import { extractCancelledOrders } from "./utils";

/**
 * MARKET — BEKORLARINING 3 TABI (vOczoOUE 2-bosqich, BG3 M0EPcJVf; maketlar `market-new-orders-cancelled`,
 * `market-new-orders-cancelled-transit`, `market-new-orders-cancelled-received`):
 *  - «Olib ketishga tayyor» — HQ'da turganlar: mavjud parametrsiz so'rov (QR bilan topshirish ro'yxati);
 *  - «Yo'lda» — hali HQ'ga yetmagan: `stage=courier,in_transit,branch`;
 *  - «Olganlarim» — marketga topshirilgan: `stage=market&start_day=…&end_day=…` (topshirish vaqti bo'yicha).
 * Backend `stage` ni faqat MARKET roli uchun qo'llaydi; javob `{ data, total, truncated? }` (≤ 5000).
 */
export type MarketReturnsView = "ready" | "transit" | "received";

export const MARKET_RETURNS_VIEWS: readonly MarketReturnsView[] = ["ready", "transit", "received"];
/** URL kaliti (`?view=transit`) — tab sahifa yangilansa ham saqlanadi. */
export const MARKET_RETURNS_VIEW_KEY = "view";
export const MARKET_TRANSIT_STAGES = "courier,in_transit,branch";
export const MARKET_RECEIVED_STAGE = "market";

export const parseMarketReturnsView = (value: string | null | undefined): MarketReturnsView =>
  value === "transit" || value === "received" ? value : "ready";

export type MarketReturnsRange = { from: string; to: string };

type Envelope = { total?: unknown; truncated?: unknown; data?: Envelope | unknown[] } | null | undefined;

/** `{ data, total, truncated }` — gateway konvertida (`{ statusCode, data: { … } }`) yoki to'g'ridan-to'g'ri. */
const listMeta = (response: unknown): { total?: unknown; truncated?: unknown } => {
  const outer = response as Envelope;
  const inner = outer?.data && !Array.isArray(outer.data) ? (outer.data as Envelope) : null;
  return { total: inner?.total ?? outer?.total, truncated: inner?.truncated ?? outer?.truncated };
};

const totalOf = (response: unknown, rows: readonly unknown[]): number => {
  const total = Number(listMeta(response).total);
  return listMeta(response).total !== undefined && Number.isFinite(total) && total >= 0 ? total : rows.length;
};

export const readTruncated = (response: unknown): boolean => listMeta(response).truncated === true;

/** Qatorlar: `{ data: [...] }` (backend) yoki konvert ichida `{ data: { data: [...] } }`. */
const extractRows = (response: unknown): OrderListItem[] => {
  const rows = extractCancelledOrders(response);
  if (rows.length > 0) return rows;
  const inner = (response as Envelope)?.data;
  return inner && !Array.isArray(inner) ? extractCancelledOrders(inner) : rows;
};

/** «Yo'lda» va «Olganlarim» so'rovlari (tab sonlari uchun ikkalasi ham oldindan). */
export const useMarketReturns = (marketId: string, { enabled, range }: { enabled: boolean; range: MarketReturnsRange }) => {
  const { useCancelledOrdersByMarket } = useOrders();
  const transitQuery = useCancelledOrdersByMarket(marketId, { enabled, stage: MARKET_TRANSIT_STAGES });
  const receivedQuery = useCancelledOrdersByMarket(marketId, {
    enabled,
    stage: MARKET_RECEIVED_STAGE,
    start_day: range.from || undefined,
    end_day: range.to || undefined,
  });
  const transitRows = useMemo(() => extractRows(transitQuery.data), [transitQuery.data]);
  const receivedRows = useMemo(() => extractRows(receivedQuery.data), [receivedQuery.data]);
  return {
    transit: {
      query: transitQuery,
      rows: transitRows,
      total: transitQuery.data !== undefined ? totalOf(transitQuery.data, transitRows) : null,
      truncated: readTruncated(transitQuery.data),
    },
    received: {
      query: receivedQuery,
      rows: receivedRows,
      total: receivedQuery.data !== undefined ? totalOf(receivedQuery.data, receivedRows) : null,
      truncated: readTruncated(receivedQuery.data),
    },
  };
};
