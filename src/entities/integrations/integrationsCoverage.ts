import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const useIntegrationsCoverage = () => {
  const client = useQueryClient();

  // ── POST · INTEGRATIONS.HEALTHCHECK ────────────────────────────────────────
  const healthcheck = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.HEALTHCHECK(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── GET · INTEGRATIONS.RECEIVABLE_BALANCE ──────────────────────────────────
  const getReceivableBalance = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["integ-cov", "receivable-balance", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.INTEGRATIONS.RECEIVABLE_BALANCE(id))
          .then((res) => res.data),
      enabled: enabled && !!id,
    });

  // ── POST · INTEGRATIONS.REMITTANCES ────────────────────────────────────────
  const createRemittance = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.REMITTANCES(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── POST · INTEGRATIONS.RETRY ───────────────────────────────────────────────
  const retry = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.RETRY(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── POST · INTEGRATIONS.SYNC ────────────────────────────────────────────────
  const sync = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.SYNC(id), data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["integ-cov", "sync-history"] }),
  });

  // ── GET · INTEGRATIONS.SYNC_HISTORY_BY_ID ──────────────────────────────────
  const getSyncHistoryById = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["integ-cov", "sync-history", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.INTEGRATIONS.SYNC_HISTORY_BY_ID(id))
          .then((res) => res.data),
      enabled: enabled && !!id,
    });

  // ── POST · INTEGRATIONS.SYNC_QUEUE ─────────────────────────────────────────
  const syncQueue = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.SYNC_QUEUE(id), data),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["integ-cov", "sync-history"] }),
  });

  // ── POST · INTEGRATIONS.TEST ────────────────────────────────────────────────
  const test = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.TEST(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── POST · INTEGRATIONS.DISPATCH ───────────────────────────────────────────
  const dispatch = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.DISPATCH(slug), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── POST · INTEGRATIONS.REQUEST ────────────────────────────────────────────
  const request = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data?: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.REQUEST(slug), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── POST · INTEGRATIONS.SEARCH_BY_QR ───────────────────────────────────────
  const searchByQr = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: any }) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.SEARCH_BY_QR(slug), data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["integ-cov"] }),
  });

  // ── GET · INTEGRATIONS.RECEIVABLES ─────────────────────────────────────────
  const getReceivables = (params?: any) =>
    useQuery({
      queryKey: ["integ-cov", "receivables", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.INTEGRATIONS.RECEIVABLES, { params })
          .then((res) => res.data),
    });

  // ── GET · INTEGRATIONS.SHIPMENT_BY_ORDER ───────────────────────────────────
  const getShipmentByOrder = (orderId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["integ-cov", "shipment", orderId],
      queryFn: () =>
        api.get(API_ENDPOINTS.INTEGRATIONS.SHIPMENT_BY_ORDER(orderId))
          .then((res) => res.data),
      enabled: enabled && !!orderId,
    });

  // ── GET · INTEGRATIONS.SYNC_HISTORY ────────────────────────────────────────
  const getSyncHistory = (params?: any) =>
    useQuery({
      queryKey: ["integ-cov", "sync-history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.INTEGRATIONS.SYNC_HISTORY, { params })
          .then((res) => res.data),
    });

  return {
    healthcheck,
    getReceivableBalance,
    createRemittance,
    retry,
    sync,
    getSyncHistoryById,
    syncQueue,
    test,
    dispatch,
    request,
    searchByQr,
    getReceivables,
    getShipmentByOrder,
    getSyncHistory,
  };
};
