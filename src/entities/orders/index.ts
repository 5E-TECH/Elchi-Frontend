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

  const uploadProofFile = async (proof: File) => {
    const formData = new FormData();
    formData.append("file", proof);
    formData.append("folder", "proof");

    const response = await api.post(API_ENDPOINTS.FILES.UPLOAD, formData);
    const key =
      response.data?.data?.key ??
      response.data?.key;

    if (!key) {
      throw new Error("Proof file upload did not return a key");
    }

    return String(key);
  };

  const toOrderActionBody = async (data: Record<string, unknown>) => {
    if (!(data.proof instanceof File)) return data;

    const { proof, proofFileKeys, ...rest } = data;
    const uploadedKey = await uploadProofFile(proof);
    const existingKeys = Array.isArray(proofFileKeys)
      ? proofFileKeys.map(String).filter(Boolean)
      : [];

    return {
      ...rest,
      proofFileKeys: Array.from(new Set([...existingKeys, uploadedKey])),
    };
  };

  // A sell/cancel/rollback/partly-sell moves COD cash across cashboxes, so the
  // finance/cashbox caches (separate key space, 30s staleTime) must be refreshed
  // too — otherwise balances shown right after the action are stale. (Audit P1-3.)
  const invalidateMoney = () => {
    client.invalidateQueries({ queryKey: [orders] });
    client.invalidateQueries({ queryKey: ["finance-cov"] });
    client.invalidateQueries({ queryKey: ["cashbox"] });
    client.invalidateQueries({ queryKey: ["dashboard"] });
  };

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

  const useGetTodayOrders = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKETS_NEW, { params }).then((res) => res.data),
      enabled,
    });

  const useGetTodayOrdersByMarket = (
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
      enabled: enabled && Boolean(marketId),
    });

  const useGetOrderById = (orderId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [orders, orderId],
      queryFn: () => api.get(API_ENDPOINTS.ORDERS.BY_ID(orderId)).then((res) => res.data),
      enabled: enabled && Boolean(orderId),
    });

  const useGetOrderCourier = (params?: { status?: string; page?: number; limit?: number }) =>
    useQuery({
      queryKey: [orders, "courier", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.COURIER_ORDERS, { params }).then((res) => res.data),
    });

  const useCancelledMarkets = (params?: { search?: string }) =>
    useQuery({
      queryKey: [orders, "markets", "cancelled", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED, { params }).then((res) => res.data),
    });

  const useCancelledOrdersByMarket = (marketId: string | number) =>
    useQuery({
      queryKey: [orders, "markets", marketId, "cancelled"],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKET_CANCELLED(marketId)).then((res) => res.data),
      enabled: Boolean(marketId),
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
      data: { comment: string; extraCost: number; proof?: File };
    }) =>
      toOrderActionBody(data).then((body) =>
        api.post(API_ENDPOINTS.ORDERS.SELL(orderId), body).then((res) => res.data),
      ),
    onSuccess: invalidateMoney,
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
        proof?: File;
      };
    }) =>
      toOrderActionBody(data).then((body) =>
        api.post(API_ENDPOINTS.ORDERS.PARTLY_SELL(orderId), body).then((res) => res.data),
      ),
    onSuccess: invalidateMoney,
  });

  const RollbackOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.post(API_ENDPOINTS.ORDERS.ROLLBACK(orderId)).then((res) => res.data),
    onSuccess: invalidateMoney,
  });

  const SendToPost = useMutation({
    mutationFn: (order_ids: string[]) =>
      api.post(API_ENDPOINTS.POSTS.CANCEL, { order_ids }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const handoverCancelledOrders = useMutation({
    mutationFn: ({
      marketId,
      orderIds,
      authorizationToken,
      manualOverrides,
    }: {
      marketId: string | number;
      orderIds: string[];
      authorizationToken?: string;
      manualOverrides?: Array<{ order_id: string; reason: string }>;
    }) =>
      api
        .post(API_ENDPOINTS.ORDERS.MARKET_CANCELLED_HANDOVER(marketId), {
          order_ids: orderIds,
          ...(authorizationToken ? { authorization_token: authorizationToken } : {}),
          ...(manualOverrides?.length ? { manual_overrides: manualOverrides } : {}),
        })
        .then((res) => res.data),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: [orders] });
      client.invalidateQueries({ queryKey: [orders, "markets", "cancelled"] });
      client.invalidateQueries({ queryKey: [orders, "markets", variables.marketId, "cancelled"] });
    },
  });

  const generateCancelledMarketQr = useMutation({
    mutationFn: (marketId: string | number) =>
      api.post(API_ENDPOINTS.ORDERS.MARKET_CANCELLED_QR(marketId)).then((res) => res.data),
  });

  const scanMarketCancelledQr = useMutation({
    mutationFn: (qrToken: string) =>
      api.post(API_ENDPOINTS.SCAN.MARKET_CANCELLED, { qr_token: qrToken }).then((res) => res.data),
  });

  const CancelOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: { comment: string; extraCost: number; paidAmount: number; proof?: File };
    }) =>
      toOrderActionBody(data).then((body) =>
        api.post(API_ENDPOINTS.ORDERS.CANCEL(orderId), body).then((res) => res.data),
      ),
    onSuccess: invalidateMoney,
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
    useGetTodayOrders,
    useGetTodayOrdersByMarket,
    useGetOrderById,
    useGetOrderCourier,
    useCancelledMarkets,
    useCancelledOrdersByMarket,
    SendToPost,
    generateCancelledMarketQr,
    scanMarketCancelledQr,
    handoverCancelledOrders,
    RollbackOrder,
    updateNewOrder,
    deleteOrder,
    SellOrder,
    PartlySellOrder,
    CancelOrder
  };
};
