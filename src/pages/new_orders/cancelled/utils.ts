import type { OrderListItem } from "../../../entities/order/types/order";

type CancelledMarket = {
  market_id: string;
  orders_count: number;
  total_price_sum: number;
  market?: {
    id?: string;
    name?: string;
    phone_number?: string;
  };
};

type CancelledMarketRow = {
  market_id: string;
  name: string;
  phone_number: string;
  orders_count: number;
  total_price_sum: number;
};

type OrdersResponse = {
  data?: unknown;
  items?: unknown[];
  orders?: unknown[];
};

const extractItems = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) return response;

  const source = response as OrdersResponse | undefined;
  if (Array.isArray(source?.data)) return source.data as T[];
  if (source?.data && !Array.isArray(source.data)) {
    const data = source.data as OrdersResponse;
    if (Array.isArray(data.items)) return data.items as T[];
    if (Array.isArray(data.orders)) return data.orders as T[];
  }
  if (Array.isArray(source?.items)) return source.items as T[];
  return Array.isArray(source?.orders) ? source.orders as T[] : [];
};

export const extractCancelledOrders = (response: unknown): OrderListItem[] =>
  extractItems<OrderListItem>(response);

export const extractCancelledMarkets = (response: unknown): CancelledMarketRow[] =>
  extractItems<CancelledMarket>(response).map((item) => ({
    market_id: String(item.market_id ?? item.market?.id ?? ""),
    name: item.market?.name ?? "—",
    phone_number: item.market?.phone_number ?? "—",
    orders_count: Number(item.orders_count) || 0,
    total_price_sum: Number(item.total_price_sum) || 0,
  })).filter((item) => item.market_id);
