import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";


const dashboard = "dashboard"

export const useDashboard = () => {
    const getDashboard = (params?: any, enabled: boolean = true) =>
        useQuery({
            queryKey: [dashboard, params],
            queryFn: () => api.get("analytics/dashboard", { params }).then((res) => res.data),
            enabled,
        });

    const getRevenue = (params?: any, enabled: boolean = true) =>
        useQuery({
            queryKey: ["revenue", params],
            queryFn: () => api.get("analytics/revenue", { params }).then((res) => res.data),
            enabled,
        });

    return { getDashboard, getRevenue }
};