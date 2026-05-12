import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { isInactiveMarketStatus, unwrapMarketPayload } from "../../../shared/lib/marketStatus";
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
        mutationFn: async (data: CreateOrderRequest) => {
            if (data.market_id) {
                const marketResponse = await api
                    .get(API_ENDPOINTS.MARKETS.BY_ID(data.market_id))
                    .then((res) => res.data);
                const market = unwrapMarketPayload(marketResponse);

                if (isInactiveMarketStatus(market?.status)) {
                    throw new Error("Faol emas market uchun yangi buyurtma yaratib bo'lmaydi.");
                }
            }

            return api.post(API_ENDPOINTS.ORDERS.BASE, data).then((res) => res.data);
        },
        onSuccess: () =>
            client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "active" }),
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
