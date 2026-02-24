import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import type { CreateOrderRequest } from "../types/order";

export const ORDER_KEY = "orders";

export const useOrders = () => {
    const client = useQueryClient();

    const createOrder = useMutation({
        mutationFn: (data: CreateOrderRequest) =>
            api.post("orders", data).then((res) => res.data),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "active" }),
    });

    const getOrders = (params?: any) =>
        useQuery({
            queryKey: [ORDER_KEY, params],
            queryFn: () => api.get("orders", { params }).then((res) => res.data),
        });

    return { createOrder, getOrders };
};
