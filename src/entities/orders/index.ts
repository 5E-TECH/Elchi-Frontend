import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

const orders = "orders";

export const useOrders = () => {
  const client = useQueryClient();

  const getTodayOrders = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, params],
      queryFn: () =>
        api.get("orders/markets/today", { params }).then((res) => res.data),
      enabled,
    });

  const getTodayOrdersByMarket = (
    marketId: number,
    params?: any,
    enabled: boolean = true,
  ) =>
    useQuery({
      queryKey: [orders, marketId, params],
      queryFn: () =>
        api
          .get(`orders/markets/${marketId}/new`, { params })
          .then((res) => res.data),
      enabled,
    });

  const getOrderById = (orderId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, orderId],
      queryFn: () => api.get(`orders/${orderId}`).then((res) => res.data),
      enabled,
    });

  const deleteOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.delete(`orders/${orderId}`).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  return { getTodayOrders, getTodayOrdersByMarket, getOrderById, deleteOrder };
};
