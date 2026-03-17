import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

const orders = "orders";

export const useOrders = () => {
  const client = useQueryClient();


  const createReceiveOrder = useMutation({
    mutationFn: (data: any) =>
      api.post("orders/receive", data).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    }
  });

  const getTodayOrders = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, params],
      queryFn: () =>
        api.get("orders/markets/new", { params }).then((res) => res.data),
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

     const getOrderCourier = (params?: { status?: string }) =>
    useQuery({
      queryKey: [orders, "courier", params],
      queryFn: () =>
        api.get(`orders/courier/orders`, { params }).then((res) => res.data),
    });


  const updateNewOrder = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: any }) =>
      api.patch(`orders/${orderId}/full`, data).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  })

  const SellOrder = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: { comment: string; extraCost: number } }) =>
      api.post(`orders/sell/${orderId}`, data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });


    const PartlySellOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: {
        order_item_info: { product_id: string; quantity: number }[];
        totalPrice: number;
        extraCost: number;
        comment: string;
      };
    }) => api.post(`orders/partly-sell/${orderId}`, data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });


    const RollbackOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.post(`orders/rollback/${orderId}`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

    const SendToPost = useMutation({
    mutationFn: (order_ids: string[]) =>
      api.post(`post/cancel`, { order_ids }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });



  const deleteOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.delete(`orders/${orderId}`).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  return { createReceiveOrder, getTodayOrders, getTodayOrdersByMarket, getOrderById, getOrderCourier, SendToPost, RollbackOrder, updateNewOrder, deleteOrder, SellOrder, PartlySellOrder };
};
