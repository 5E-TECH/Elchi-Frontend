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
                client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "active" }),
                client.invalidateQueries({ queryKey: ["dashboard"], refetchType: "active" }),
            ]);
        },
    });

    const useGetOrders = (
        params?: OrderListParams,
        enabled = true,
        refetchInterval?: (data: OrderListResponse | undefined) => number | false,
        /**
         * `silentError` — xato umumiy bildirishnoma bermaydi (masalan filtr varaqasidagi yordamchi son).
         * `silentErrorWhenCached` — faqat keshda ma'lumot bo'lsa (OR-1: sahifa «Ro'yxat yangilanmadi» ni o'zi
         * chizadi); `refetchOnWindowFocus` — ilovaga qaytganda qayta so'rash (faqat shu so'rovda).
         */
        options?: { silentError?: boolean; silentErrorWhenCached?: boolean; refetchOnWindowFocus?: boolean },
    ) => {
        const queryKey = [ORDER_KEY, params];
        const silentError =
            Boolean(options?.silentError) ||
            (Boolean(options?.silentErrorWhenCached) && client.getQueryData(queryKey) !== undefined);
        return useQuery<OrderListResponse>({
            queryKey,
            queryFn: () => api.get(API_ENDPOINTS.ORDERS.BASE, { params }).then((res) => res.data),
            enabled,
            placeholderData: (prev) => prev,
            refetchInterval: refetchInterval ? (query) => refetchInterval(query.state.data) : undefined,
            // Berilgan bo'lsa aniq (to'xtatilganda `false`) — global sukutga tayanmaydi.
            ...(options?.refetchOnWindowFocus !== undefined ? { refetchOnWindowFocus: options.refetchOnWindowFocus } : {}),
            ...(silentError ? { meta: { silentError: true } } : {}),
        });
    };

    const useGetExternalOrders = (params?: ExternalOrdersParams) =>
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

    return { createOrder, useGetOrders, useGetExternalOrders, assignCourier };
};
