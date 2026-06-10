import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

const orders = "orders";

export type UpdateNewOrderPayload = Partial<{
  region_id: string;
  district_id: string;
  address: string;
  where_deliver: string;
  total_price: number;
  comment: string;
  items: { product_id: string; quantity: number }[];
}>;

export const useOrders = () => {
  const client = useQueryClient();

  const createReceiveOrder = useMutation({
    mutationFn: (data: { orderIds?: string[]; order_ids?: string[] }) => {
      const normalizedOrderIds = Array.isArray(data?.order_ids)
        ? data.order_ids
        : Array.isArray(data?.orderIds)
          ? data.orderIds
          : [];

      return api
        .post(API_ENDPOINTS.ORDERS.RECEIVE, { order_ids: normalizedOrderIds })
        .then((res) => res.data);
    },
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const createTransferBatch = useMutation({
    mutationFn: (data: { orderIds: string[] }) =>
      api.post(API_ENDPOINTS.BRANCHES.TRANSFER_BATCHES, data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const getTodayOrders = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKETS_NEW, { params }).then((res) => res.data),
      enabled,
    });

  const getTodayOrdersByMarket = (
    marketId: string | number,
    params?: any,
    enabled: boolean = true,
  ) =>
    useQuery({
      queryKey: [orders, marketId, params],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.ORDERS.MARKET_NEW(marketId), { params })
          .then((res) => res.data),
      enabled,
    });

  const getOrderById = (orderId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, orderId],
      queryFn: () => api.get(API_ENDPOINTS.ORDERS.BY_ID(orderId)).then((res) => res.data),
      enabled,
    });

  const getOrderCourier = (params?: { status?: string; page?: number; limit?: number }) =>
    useQuery({
      queryKey: [orders, "courier", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.COURIER_ORDERS, { params }).then((res) => res.data),
    });

  const updateNewOrder = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: UpdateNewOrderPayload }) =>
      api.patch(API_ENDPOINTS.ORDERS.FULL(orderId), data).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const SellOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: { comment: string; extraCost: number };
    }) => api.post(API_ENDPOINTS.ORDERS.SELL(orderId), data).then((res) => res.data),
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
    }) =>
      api.post(API_ENDPOINTS.ORDERS.PARTLY_SELL(orderId), data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const RollbackOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.post(API_ENDPOINTS.ORDERS.ROLLBACK(orderId)).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const SendToPost = useMutation({
    mutationFn: (order_ids: string[]) =>
      api.post(API_ENDPOINTS.POSTS.CANCEL, { order_ids }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const CancelOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: { comment: string; extraCost: number; paidAmount: number };
    }) => api.post(API_ENDPOINTS.ORDERS.CANCEL(orderId), data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.delete(API_ENDPOINTS.ORDERS.BY_ID(orderId)).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  return {
    createReceiveOrder,
    createTransferBatch,
    getTodayOrders,
    getTodayOrdersByMarket,
    getOrderById,
    getOrderCourier,
    SendToPost,
    RollbackOrder,
    updateNewOrder,
    deleteOrder,
    SellOrder,
    PartlySellOrder,
    CancelOrder
  };
};
