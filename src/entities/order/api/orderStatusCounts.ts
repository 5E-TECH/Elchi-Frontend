import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { OrderListParams } from "../types/order";

/**
 * BUYURTMA HOLAT TABLARI SONLARI — `GET /orders/status-counts` (GaBIPi3Z, FRONTEND_CHANGELOG 2026-10-26).
 *
 * - Filtrlar va rol doirasi `GET /orders` bilan aynan bir xil; `status` / `page` / `limit` / `sort_*` e'tiborsiz —
 *   shuning uchun kalitga ham kirmaydi (`toStatusCountsParams`): tab yoki sahifa almashsa qayta so'ralmaydi.
 * - `paid` = `paid` + `partly_paid`, `cancelled` = `cancelled` + `cancelled (sent)` — `ORDER_STATUS_TABS` bilan bir xil.
 * - `new_incoming` — «Qabul va yaratish» badge'i (ro'yxat filtrlariga bog'liq emas, filtrsiz so'raladi); `null` —
 *   bu bo'lim yo'q rollarda (operator, kuryer, logist) → badge chiqmaydi.
 * - Kalit `["orders", "status-counts", params]` — `["orders"]` prefiksi ostida: buyurtma amallari (sotish, bekor,
 *   qabul, yaratish …) va jonli kanal hodisasi ro'yxat bilan birga sonlarni ham yangilaydi. Filtrsiz kalit
 *   (`{}`) — yon menyu badge'i va filtrsiz `/orders` tablari bitta so'rovni ulashadi.
 * - Yordamchi so'rov: xato global xabar bermaydi (`silentError`) — sonlar chizilmaydi yoki eskisi qoladi.
 */

export type OrderStatusCountKey =
  | "all"
  | "new"
  | "received"
  | "on_the_road"
  | "waiting"
  | "sold"
  | "paid"
  | "cancelled";

export const ORDER_STATUS_COUNT_KEYS: readonly OrderStatusCountKey[] = [
  "all",
  "new",
  "received",
  "on_the_road",
  "waiting",
  "sold",
  "paid",
  "cancelled",
];

export type OrderStatusCounts = Record<OrderStatusCountKey, number> & {
  /** «Qabul va yaratish» badge'i; `null` — bu rolda bo'lim yo'q. */
  new_incoming: number | null;
};

export const ORDER_STATUS_COUNTS_QUERY_KEY = ["orders", "status-counts"] as const;

/** Ro'yxat bilan birga yangilanish oralig'i (OR-1 — `ORDERS_REFRESH_INTERVAL_MS` bilan bir xil). */
export const ORDER_STATUS_COUNTS_REFRESH_MS = 60_000;

const toCount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

/** `successRes` konverti (`{ data: {...} }`) → sonlar; shakl boshqacha bo'lsa `null` (tablar sonsiz chiziladi). */
export const parseOrderStatusCounts = (body: unknown): OrderStatusCounts | null => {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const data =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;
  if (!data) return null;
  const counts = {} as Record<OrderStatusCountKey, number>;
  for (const key of ORDER_STATUS_COUNT_KEYS) {
    const value = toCount(data[key]);
    if (value === null) return null;
    counts[key] = value;
  }
  return { ...counts, new_incoming: toCount(data.new_incoming) };
};

/** `GET /orders` parametrlari → sonlar so'rovi parametrlari: holat, sahifa va saralash olib tashlanadi. */
export const toStatusCountsParams = (params: OrderListParams): OrderListParams => {
  const rest: OrderListParams = { ...params };
  delete rest.status;
  delete rest.page;
  delete rest.limit;
  delete rest.sort_by;
  delete rest.sort_dir;
  delete rest.fetch_all;
  return rest;
};

export const orderStatusCountsQueryKey = (params: OrderListParams) =>
  [...ORDER_STATUS_COUNTS_QUERY_KEY, toStatusCountsParams(params)] as const;

const fetchOrderStatusCounts = (params: OrderListParams) =>
  api
    .get(API_ENDPOINTS.ORDERS.STATUS_COUNTS, { params: toStatusCountsParams(params) })
    .then((res) => parseOrderStatusCounts(res.data));

type StatusCountsOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
};

/**
 * `/orders` holat tablari sonlari — ro'yxat filtrlari bilan. Filtr almashganda yangi javob kelguncha oldingi sonlar
 * turadi (`isPlaceholderData` — sahifa ularni xira, `countBusy` qiladi).
 */
export const useOrderStatusCounts = (params: OrderListParams, options: StatusCountsOptions = {}) =>
  useQuery({
    queryKey: orderStatusCountsQueryKey(params),
    queryFn: () => fetchOrderStatusCounts(params),
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
    refetchInterval: options.refetchInterval ?? false,
    // Berilgan bo'lsa aniq (to'xtatilganda `false`) — global sukutga tayanmaydi.
    ...(options.refetchOnWindowFocus !== undefined ? { refetchOnWindowFocus: options.refetchOnWindowFocus } : {}),
    meta: { silentError: true },
  });

/**
 * «Qabul va yaratish» badge'i — filtrsiz `GET /orders/status-counts` ning `new_incoming` i. `null` — badge yo'q
 * (bo'lim yo'q rol, so'rov yiqildi yoki hali kelmadi).
 */
export const useNewIncomingOrdersCount = (enabled: boolean): number | null => {
  const query = useQuery({
    queryKey: orderStatusCountsQueryKey({}),
    queryFn: () => fetchOrderStatusCounts({}),
    enabled,
    refetchInterval: enabled ? ORDER_STATUS_COUNTS_REFRESH_MS : false,
    meta: { silentError: true },
  });
  return enabled ? (query.data?.new_incoming ?? null) : null;
};
