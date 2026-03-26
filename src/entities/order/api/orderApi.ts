import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { CreateOrderRequest, OrderListParams, OrderListResponse } from "../types/order";

export const ORDER_KEY = "orders";

export const useOrders = () => {
    const client = useQueryClient();

    const createOrder = useMutation({
        mutationFn: (data: CreateOrderRequest) =>
            api.post(API_ENDPOINTS.ORDERS.BASE, data).then((res) => res.data),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "active" }),
    });

    const getOrders = (params?: OrderListParams) =>
        useQuery<OrderListResponse>({
            queryKey: [ORDER_KEY, params],
            queryFn: () => api.get(API_ENDPOINTS.ORDERS.BASE, { params }).then((res) => res.data),
        });

    return { createOrder, getOrders };
};
