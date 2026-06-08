import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

const dashboard = "dashboard";

export interface AnalyticsDateParams {
  start_day?: string;
  end_day?: string;
}

export interface RevenueParams extends AnalyticsDateParams {
  period: "daily" | "weekly" | "monthly" | "yearly";
  startDate?: string;
  endDate?: string;
}

export interface DashboardOrdersSummary {
  acceptedCount: number;
  cancelled: number;
  soldAndPaid: number;
  profit: number;
  from?: number;
  to?: number;
}

export interface BranchDashboardOrdersCard {
  total: number;
  new: number;
  on_the_road: number;
  delivered: number;
  returned: number;
}

export interface BranchDashboardMarketCard {
  id?: string | number;
  name?: string;
  title?: string;
  orders?: number;
  orders_count?: number;
  total?: number;
  amount?: number;
  total_amount?: number;
  price?: number;
}

export interface BranchDashboardPackagesCard {
  on_the_way: number;
  waiting_for_acceptance: number;
}

export interface BranchDashboardCouriersCard {
  total?: number;
  active?: number;
  active_today?: number;
  active_count?: number;
}

export interface BranchDashboardPayload {
  today_orders_count: number;
  week_orders_count: number;
  active_batches_count: number;
  couriers_count: number;
  role?: string;
  cards: {
    orders: BranchDashboardOrdersCard | null;
    markets: BranchDashboardMarketCard[] | null;
    packages: BranchDashboardPackagesCard | null;
    couriers: BranchDashboardCouriersCard | null;
  };
  visibility?: {
    orders?: boolean;
    markets?: boolean;
    packages?: boolean;
    couriers?: boolean;
  };
}

export interface TopMarket {
  market_id: string;
  market_name: string | null;
  total_orders: number;
  successful_orders: number;
  success_rate: number;
}

export interface TopCourier {
  courier_id: string;
  courier_name: string | null;
  total_orders: number;
  successful_orders: number;
  success_rate: number;
}

export interface DashboardResponse {
  statusCode: number;
  message: string;
  data: {
    orders: DashboardOrdersSummary;
    markets?: unknown[];
    couriers?: unknown[];
    topMarkets?: TopMarket[];
    topCouriers?: TopCourier[];
    branchDashboard?: BranchDashboardPayload | null;
  };
}

export interface RevenuePoint {
  period: string;
  label: string;
  ordersCount: number;
  revenue: number;
}

export interface RevenueResponse {
  statusCode: number;
  message: string;
  data: {
    chart?: {
      labels?: string[];
      values?: number[];
    };
    finance?: {
      currentSituation?: number;
      main?: {
        balance?: number;
      };
      markets?: {
        marketsTotalBalans?: number;
      };
      couriers?: {
        couriersTotalBalanse?: number;
      };
      difference?: number;
    };
    [key: string]: unknown;
  };
}

export interface KpiResponse {
  statusCode: number;
  message: string;
  data: {
    averageOrderValue: number;
    averageFulfillmentHours: number;
    onTimeRate: number;
    cancellationRate: number;
    courierEfficiency: number;
    marketRating: unknown[];
  };
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const cleanAnalyticsParams = (params?: object): Record<string, unknown> | undefined => {
  if (!params) return undefined;

  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, value]) => value !== "" && value !== null && value !== undefined,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const normalizePerformerMetrics = (value: unknown) => {
  const item = asRecord(value);
  return {
    item,
    total_orders: toNumber(item.total_orders ?? item.totalOrders),
    successful_orders: toNumber(item.successful_orders ?? item.successfulOrders),
    success_rate: toNumber(item.success_rate ?? item.successRate),
  };
};

const normalizeTopMarket = (value: unknown): TopMarket => {
  const metrics = normalizePerformerMetrics(value);
  return {
    market_id: String(metrics.item.market_id ?? metrics.item.marketId ?? metrics.item.id ?? ""),
    market_name: String(
      metrics.item.market_name ?? metrics.item.marketName ?? metrics.item.name ?? "",
    ) || null,
    total_orders: metrics.total_orders,
    successful_orders: metrics.successful_orders,
    success_rate: metrics.success_rate,
  };
};

const normalizeTopCourier = (value: unknown): TopCourier => {
  const metrics = normalizePerformerMetrics(value);
  return {
    courier_id: String(
      metrics.item.courier_id ?? metrics.item.courierId ?? metrics.item.id ?? "",
    ),
    courier_name: String(
      metrics.item.courier_name ?? metrics.item.courierName ?? metrics.item.name ?? "",
    ) || null,
    total_orders: metrics.total_orders,
    successful_orders: metrics.successful_orders,
    success_rate: metrics.success_rate,
  };
};

export const normalizeDashboardResponse = (payload: unknown): DashboardResponse => {
  const response = asRecord(payload);
  const data = asRecord(response.data);
  const orders = asRecord(data.orders);
  const topMarkets = data.topMarkets ?? data.top_markets;
  const topCouriers = data.topCouriers ?? data.top_couriers;

  return {
    statusCode: toNumber(response.statusCode),
    message: String(response.message ?? ""),
    data: {
      ...data,
      orders: {
        acceptedCount: toNumber(orders.acceptedCount ?? orders.accepted_count),
        cancelled: toNumber(orders.cancelled ?? orders.cancelledCount ?? orders.cancelled_count),
        soldAndPaid: toNumber(orders.soldAndPaid ?? orders.sold_and_paid),
        profit: toNumber(orders.profit),
        from: orders.from === undefined ? undefined : toNumber(orders.from),
        to: orders.to === undefined ? undefined : toNumber(orders.to),
      },
      topMarkets: Array.isArray(topMarkets)
        ? topMarkets.map(normalizeTopMarket)
        : [],
      topCouriers: Array.isArray(topCouriers)
        ? topCouriers.map(normalizeTopCourier)
        : [],
    },
  };
};

export const normalizeKpiResponse = (payload: unknown): KpiResponse => {
  const response = asRecord(payload);
  const data = asRecord(response.data);
  const marketRating = data.marketRating ?? data.market_rating;

  return {
    statusCode: toNumber(response.statusCode),
    message: String(response.message ?? ""),
    data: {
      averageOrderValue: toNumber(data.averageOrderValue ?? data.average_order_value),
      averageFulfillmentHours: toNumber(
        data.averageFulfillmentHours ?? data.average_fulfillment_hours,
      ),
      onTimeRate: toNumber(data.onTimeRate ?? data.on_time_rate),
      cancellationRate: toNumber(data.cancellationRate ?? data.cancellation_rate),
      courierEfficiency: toNumber(data.courierEfficiency ?? data.courier_efficiency),
      marketRating: Array.isArray(marketRating) ? marketRating : [],
    },
  };
};

const useGetDashboard = (params?: AnalyticsDateParams, enabled = true) =>
  useQuery<DashboardResponse>({
    queryKey: [dashboard, cleanAnalyticsParams(params)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ANALYTICS.DASHBOARD, { params: cleanAnalyticsParams(params) })
        .then((res) => normalizeDashboardResponse(res.data)),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

const useGetKpi = (params?: AnalyticsDateParams, enabled = true) =>
  useQuery<KpiResponse>({
    queryKey: ["kpi", cleanAnalyticsParams(params)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ANALYTICS.KPI, { params: cleanAnalyticsParams(params) })
        .then((res) => normalizeKpiResponse(res.data)),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

const useGetRevenue = (params: RevenueParams, enabled = true) =>
  useQuery<RevenueResponse>({
    queryKey: ["revenue", cleanAnalyticsParams(params)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ANALYTICS.REVENUE, { params: cleanAnalyticsParams(params) })
        .then((res) => res.data),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useDashboard = () => {
  return {
    getDashboard: useGetDashboard,
    getKpi: useGetKpi,
    getRevenue: useGetRevenue,
  };
};
