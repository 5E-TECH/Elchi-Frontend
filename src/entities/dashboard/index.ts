import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";


const dashboard = "dashboard"

export const useDashboard = () => {
    const getDashboard = (params?: any, enabled: boolean = true) =>
        useQuery({
            queryKey: [dashboard, params],
            queryFn: () => api.get(API_ENDPOINTS.ANALYTICS.DASHBOARD, { params }).then((res) => res.data),
            enabled,
        });

    const getRevenue = (params?: any, enabled: boolean = true) =>
        useQuery({
            queryKey: ["revenue", params],
            queryFn: () => api.get(API_ENDPOINTS.ANALYTICS.REVENUE, { params }).then((res) => res.data),
            enabled,
        });

    return { getDashboard, getRevenue }
};
