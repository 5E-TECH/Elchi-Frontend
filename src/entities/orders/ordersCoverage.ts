import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * Lump-sum hisob-kitob oyoqlari (`POST orders/settlement/courier-to-branch | branch-to-hq | hq-to-market`) bu yerdan
 * olib tashlandi (XAtqsRNH d381b1): backend ularni 410 Gone qiladi — pul har-buyurtma FIFO daftari va kassa
 * to'lovlari (`entities/payments` → `refreshCashboxQueries`) orqali yuradi. `GET orders/:id/settlement` (holat) qoladi.
 */
export const useOrdersCoverage = () => {
  const client = useQueryClient();

  // ── GET hooks ─────────────────────────────────────────────────────────────

  const useGetOrderTracking = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["orders-cov", "tracking", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.TRACKING(id)).then((res) => res.data),
      enabled,
    });

  const useGetSettlementState = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["orders-cov", "settlement-state", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.SETTLEMENT_STATE(id))
          .then((res) => res.data),
      enabled,
    });

  const useGetOrdersByMarket = (marketId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["orders-cov", "by-market", marketId],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.BY_MARKET(marketId))
          .then((res) => res.data),
      enabled,
    });

  // ── PATCH mutations ───────────────────────────────────────────────────────

  const updateOrder = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.patch(API_ENDPOINTS.ORDERS.BY_ID(id), data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  // ── POST mutations ────────────────────────────────────────────────────────

  const couldNotDeliver = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.ORDERS.COULD_NOT_DELIVER(id), data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const initiateReturn = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.ORDERS.INITIATE_RETURN(id), data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const markReturnedToMarket = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.ORDERS.MARK_RETURNED_TO_MARKET(id), data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const createExternalOrder = useMutation({
    mutationFn: (data?: any) =>
      api.post(API_ENDPOINTS.ORDERS.EXTERNAL, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const receiveExternalOrder = useMutation({
    mutationFn: (data?: any) =>
      api.post(API_ENDPOINTS.ORDERS.EXTERNAL_RECEIVE, data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const receiveOrder = useMutation({
    mutationFn: (data?: any) =>
      api.post(API_ENDPOINTS.ORDERS.RECEIVE, data).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const scanAssign = useMutation({
    mutationFn: (data?: any) =>
      api.post(API_ENDPOINTS.ORDERS.SCAN_ASSIGN, data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  const telegramBotCreate = useMutation({
    mutationFn: (data?: any) =>
      api.post(API_ENDPOINTS.ORDERS.TELEGRAM_BOT_CREATE, data)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders-cov"] }),
  });

  return {
    // GET
    useGetOrderTracking,
    useGetSettlementState,
    useGetOrdersByMarket,
    // PATCH
    updateOrder,
    // POST
    couldNotDeliver,
    initiateReturn,
    markReturnedToMarket,
    createExternalOrder,
    receiveExternalOrder,
    receiveOrder,
    scanAssign,
    telegramBotCreate,
  };
};
