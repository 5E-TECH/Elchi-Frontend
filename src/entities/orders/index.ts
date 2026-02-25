import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

const orders = "orders";

export const useOrders = () => {
  // const client = useQueryClient();

  const getTodayOrders = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, params],
      queryFn: () => api.get("orders/markets/today", { params }).then((res) => res.data),
      enabled,
    });


    const getTodayOrdersByMarket = (marketId: number, params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, marketId, params],
      queryFn: () => api.get(`orders/markets/${marketId}/new`, { params }).then((res) => res.data),
      enabled
    })


    return { getTodayOrders, getTodayOrdersByMarket }
};
