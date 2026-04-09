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

export interface DashboardResponse {
  statusCode: number;
  message: string;
  data: {
    orders: DashboardOrdersSummary;
    markets?: unknown[];
    couriers?: unknown[];
    topMarkets?: unknown[];
    topCouriers?: unknown[];
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
