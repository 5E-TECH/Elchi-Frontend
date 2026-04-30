import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

const dashboard = "dashboard";

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

export interface DashboardResponse {
  statusCode: number;
  message: string;
  data: {
    orders: DashboardOrdersSummary;
    markets?: unknown[];
    couriers?: unknown[];
    topMarkets?: unknown[];
    topCouriers?: unknown[];
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

export const useDashboard = () => {
    const getDashboard = (params?: any, enabled: boolean = true) =>
        useQuery<DashboardResponse>({
            queryKey: [dashboard, params],
            queryFn: () => api.get(API_ENDPOINTS.ANALYTICS.DASHBOARD, { params }).then((res) => res.data),
            enabled,
            placeholderData: (prev) => prev,
        });

    const getRevenue = (params?: any, enabled: boolean = true) =>
        useQuery<RevenueResponse>({
            queryKey: ["revenue", params],
            queryFn: () => api.get(API_ENDPOINTS.ANALYTICS.REVENUE, { params }).then((res) => res.data),
            enabled,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            placeholderData: (prev: any) => prev,
        });

    return { getDashboard, getRevenue }
};
