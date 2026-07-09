import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

const dashboard = "dashboard";

export interface AnalyticsDateParams {
  start_day?: string;
  end_day?: string;
  branch_id?: string;
  all?: boolean;
}

export interface RevenueParams extends AnalyticsDateParams {
  period: "daily" | "weekly" | "monthly" | "yearly";
}

export interface DashboardOrdersSummary {
  acceptedCount: number;
  cancelled: number;
  soldAndPaid: number;
  profit: number;
  totalRevenue: number;
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
  cards?: {
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
  ordersCount?: number;
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

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return Boolean(value);
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

const firstDefined = (...values: unknown[]): unknown =>
  values.find((value) => value !== undefined && value !== null);

const getDashboardOrdersRecord = (data: UnknownRecord): UnknownRecord => {
  const directOrders = asRecord(data.orders);
  if (Object.keys(directOrders).length) return directOrders;

  const summary = asRecord(data.summary);
  const summaryOrders = asRecord(summary.orders);
  if (Object.keys(summaryOrders).length) return summaryOrders;
  if (Object.keys(summary).length) return summary;

  const myStat = asRecord(data.myStat ?? data.my_stat);
  if (Object.keys(myStat).length) return myStat;

  const orderSummary = asRecord(data.orderSummary ?? data.order_summary);
  if (Object.keys(orderSummary).length) return orderSummary;

  const marketDashboard = asRecord(data.marketDashboard ?? data.market_dashboard);
  const marketOrders = asRecord(marketDashboard.orders);
  if (Object.keys(marketOrders).length) return marketOrders;
  if (Object.keys(marketDashboard).length) return marketDashboard;

  return data;
};

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

const normalizeBranchDashboard = (value: unknown): BranchDashboardPayload | null => {
  const item = asRecord(value);
  if (!Object.keys(item).length) return null;

  const cards = asRecord(item.cards);
  const orders = asRecord(cards.orders);
  const packages = asRecord(cards.packages);
  const couriers = asRecord(cards.couriers);
  const visibility = asRecord(item.visibility);
  const markets = cards.markets;

  return {
    today_orders_count: toNumber(item.today_orders_count ?? item.todayOrdersCount),
    week_orders_count: toNumber(item.week_orders_count ?? item.weekOrdersCount),
    active_batches_count: toNumber(item.active_batches_count ?? item.activeBatchesCount),
    couriers_count: toNumber(item.couriers_count ?? item.couriersCount),
    role: String(item.role ?? ""),
    cards: {
      orders: Object.keys(orders).length
        ? {
            total: toNumber(orders.total),
            new: toNumber(orders.new),
            on_the_road: toNumber(orders.on_the_road ?? orders.onTheRoad),
            delivered: toNumber(orders.delivered),
            returned: toNumber(orders.returned),
          }
        : null,
      markets: Array.isArray(markets)
        ? markets.map((market) => {
            const entry = asRecord(market);
            return {
              id: String(entry.id ?? ""),
              name: String(entry.name ?? entry.title ?? ""),
              orders: toNumber(entry.orders ?? entry.orders_count ?? entry.ordersCount ?? entry.total),
              amount: toNumber(
                entry.amount ?? entry.total_amount ?? entry.totalAmount ?? entry.price,
              ),
            };
          })
        : [],
      packages: Object.keys(packages).length
        ? {
            on_the_way: toNumber(packages.on_the_way ?? packages.onTheWay),
            waiting_for_acceptance: toNumber(
              packages.waiting_for_acceptance ?? packages.waitingForAcceptance,
            ),
          }
        : null,
      couriers: Object.keys(couriers).length
        ? {
            total: toNumber(couriers.total),
            active: toNumber(
              couriers.active ??
                couriers.active_today ??
                couriers.activeToday ??
                couriers.active_count ??
                couriers.activeCount,
            ),
          }
        : null,
    },
    visibility: {
      orders: toOptionalBoolean(visibility.orders),
      markets: toOptionalBoolean(visibility.markets),
      packages: toOptionalBoolean(visibility.packages),
      couriers: toOptionalBoolean(visibility.couriers),
    },
  };
};

export const normalizeDashboardResponse = (payload: unknown): DashboardResponse => {
  const response = asRecord(payload);
  const data = asRecord(response.data);
  const orders = getDashboardOrdersRecord(data);
  const topMarkets = data.topMarkets ?? data.top_markets;
  const topCouriers = data.topCouriers ?? data.top_couriers;
  const branchDashboard = data.branchDashboard ?? data.branch_dashboard;

  return {
    statusCode: toNumber(response.statusCode),
    message: String(response.message ?? ""),
    data: {
      ...data,
      orders: {
        acceptedCount: toNumber(
          firstDefined(
            orders.acceptedCount,
            orders.accepted_count,
            orders.accepted,
            orders.totalAccepted,
            orders.total_accepted,
            orders.acceptedOrders,
            orders.accepted_orders,
            orders.totalOrders,
            orders.total_orders,
          ),
        ),
        cancelled: toNumber(
          firstDefined(
            orders.cancelled,
            orders.cancelledCount,
            orders.cancelled_count,
            orders.canceled,
            orders.canceledCount,
            orders.canceled_count,
            orders.cancelledOrders,
            orders.cancelled_orders,
            orders.canceledOrders,
            orders.canceled_orders,
          ),
        ),
        soldAndPaid: toNumber(
          firstDefined(
            orders.soldAndPaid,
            orders.sold_and_paid,
            orders.soldAndPaidCount,
            orders.sold_and_paid_count,
            orders.soldOrders,
            orders.sold_orders,
            orders.sold,
            orders.soldCount,
            orders.sold_count,
            orders.paid,
            orders.paidCount,
            orders.paid_count,
            orders.successfulOrders,
            orders.successful_orders,
          ),
        ),
        profit: toNumber(
          firstDefined(
            orders.profit,
            orders.marketProfit,
            orders.market_profit,
            orders.netProfit,
            orders.net_profit,
            orders.profitSum,
            orders.profit_sum,
          ),
        ),
        totalRevenue: toNumber(
          firstDefined(
            orders.totalRevenue,
            orders.total_revenue,
            orders.revenue,
            orders.totalAmount,
            orders.total_amount,
          ),
        ),
        from: orders.from === undefined ? undefined : toNumber(orders.from),
        to: orders.to === undefined ? undefined : toNumber(orders.to),
      },
      topMarkets: Array.isArray(topMarkets)
        ? topMarkets.map(normalizeTopMarket)
        : [],
      topCouriers: Array.isArray(topCouriers)
        ? topCouriers.map(normalizeTopCourier)
        : [],
      branchDashboard: normalizeBranchDashboard(branchDashboard),
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

export const normalizeRevenueResponse = (payload: unknown): RevenueResponse => {
  const response = asRecord(payload);
  const data = asRecord(response.data);
  const chart = asRecord(data.chart);
  const finance = asRecord(data.finance);
  const main = asRecord(finance.main);
  const markets = asRecord(finance.markets);
  const couriers = asRecord(finance.couriers);

  return {
    statusCode: toNumber(response.statusCode),
    message: String(response.message ?? ""),
    data: {
      ...data,
      chart: {
        labels: Array.isArray(chart.labels) ? chart.labels.map(String) : [],
        values: Array.isArray(chart.values) ? chart.values.map(toNumber) : [],
      },
      finance: Object.keys(finance).length
        ? {
            currentSituation: toNumber(
              finance.currentSituation ?? finance.current_situation,
            ),
            main: { balance: toNumber(main.balance) },
            markets: {
              marketsTotalBalans: toNumber(
                markets.marketsTotalBalans ??
                  markets.marketsTotalBalance ??
                  markets.markets_total_balans ??
                  markets.markets_total_balance,
              ),
            },
            couriers: {
              couriersTotalBalanse: toNumber(
                couriers.couriersTotalBalanse ??
                  couriers.couriersTotalBalance ??
                  couriers.couriers_total_balanse ??
                  couriers.couriers_total_balance,
              ),
            },
            difference: toNumber(finance.difference),
          }
        : undefined,
    },
  };
};

const useGetDashboard = (params?: AnalyticsDateParams, enabled = true, scope = "anonymous") =>
  useQuery<DashboardResponse>({
    queryKey: [dashboard, scope, cleanAnalyticsParams(params)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ANALYTICS.DASHBOARD, { params: cleanAnalyticsParams(params) })
        .then((res) => normalizeDashboardResponse(res.data)),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

const useGetKpi = (params?: AnalyticsDateParams, enabled = true, scope = "anonymous") =>
  useQuery<KpiResponse>({
    queryKey: ["kpi", scope, cleanAnalyticsParams(params)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ANALYTICS.KPI, { params: cleanAnalyticsParams(params) })
        .then((res) => normalizeKpiResponse(res.data)),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

const useGetRevenue = (params: RevenueParams, enabled = true, scope = "anonymous") =>
  useQuery<RevenueResponse>({
    queryKey: ["revenue", scope, cleanAnalyticsParams(params)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ANALYTICS.REVENUE, { params: cleanAnalyticsParams(params) })
        .then((res) => normalizeRevenueResponse(res.data)),
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
