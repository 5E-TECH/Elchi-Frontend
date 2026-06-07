import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const useIdentityCoverage = () => {
  const client = useQueryClient();

  // ── GET · ADMINS.BASE ──────────────────────────────────────────────────────
  const getAdmins = (params?: any) =>
    useQuery({
      queryKey: ["identity-cov", "admins", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ADMINS.BASE, { params }).then((res) => res.data),
    });

  // ── GET · MANAGERS.BASE ───────────────────────────────────────────────────
  const getManagers = (params?: any) =>
    useQuery({
      queryKey: ["identity-cov", "managers", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.MANAGERS.BASE, { params }).then((res) => res.data),
    });

  // ── GET · REGISTRATORS.BASE ───────────────────────────────────────────────
  const getRegistrators = (params?: any) =>
    useQuery({
      queryKey: ["identity-cov", "registrators", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.REGISTRATORS.BASE, { params }).then((res) => res.data),
    });

  // ── GET · COURIERS.BY_REGION ──────────────────────────────────────────────
  const getCouriersByRegion = (regionId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: ["identity-cov", "couriers", "region", regionId],
      queryFn: () =>
        api.get(API_ENDPOINTS.COURIERS.BY_REGION(regionId)).then((res) => res.data),
      enabled: enabled && !!regionId,
    });

  // ── PATCH · MARKETS.ADD_ORDER ─────────────────────────────────────────────
  const addOrderToMarket = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(API_ENDPOINTS.MARKETS.ADD_ORDER(id), data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["identity-cov", "markets"] });
    },
  });

  // ── PATCH · MARKETS.EXPENSE_PROOF ────────────────────────────────────────
  const updateMarketExpenseProof = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(API_ENDPOINTS.MARKETS.EXPENSE_PROOF(id), data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["identity-cov", "markets"] });
    },
  });

  return {
    getAdmins,
    getManagers,
    getRegistrators,
    getCouriersByRegion,
    addOrderToMarket,
    updateMarketExpenseProof,
  };
};
