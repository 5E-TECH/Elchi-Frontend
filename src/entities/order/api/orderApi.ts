import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type {
    CreateOrderRequest,
    ExternalOrdersParams,
    ExternalOrdersResponse,
    OrderListParams,
    OrderListResponse,
} from "../types/order";

export const ORDER_KEY = "orders";

export interface AssignCourierRequest {
    courier_id: string;
    order_ids: string[];
}

export const useOrders = () => {
    const client = useQueryClient();

    const createOrder = useMutation({
        mutationFn: (data: CreateOrderRequest) =>
            api.post(API_ENDPOINTS.ORDERS.BASE, data).then((res) => res.data),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "all" }),
                client.invalidateQueries({ queryKey: ["dashboard"], refetchType: "all" }),
            ]);
        },
    });

    const getOrders = (params?: OrderListParams) =>
        useQuery<OrderListResponse>({
            queryKey: [ORDER_KEY, params],
            queryFn: () => api.get(API_ENDPOINTS.ORDERS.BASE, { params }).then((res) => res.data),
            placeholderData: (prev) => prev,
        });

    const getExternalOrders = (params?: ExternalOrdersParams) =>
        useQuery<ExternalOrdersResponse>({
            queryKey: [ORDER_KEY, "external", params],
            queryFn: () =>
                api.get(API_ENDPOINTS.ORDERS.EXTERNAL, { params }).then((res) => res.data),
            placeholderData: (prev) => prev,
        });

    const assignCourier = useMutation({
        mutationFn: (data: AssignCourierRequest) =>
            api.post(API_ENDPOINTS.ORDERS.ASSIGN_COURIER, data).then((res) => res.data),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "active" }),
    });

    return { createOrder, getOrders, getExternalOrders, assignCourier };
};
