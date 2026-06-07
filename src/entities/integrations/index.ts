import type { AxiosError } from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export type Integration = {
  id: string;
  name: string;
  slug: string;
  status: string;
  api_url: string;
  base_url?: string | null;
  type?: string | null;
  auth_type: string;
  auth_url?: string | null;
  username?: string | null;
  credentials?: Record<string, string> | null;
  is_active: boolean;
  market_id: string | null;
  market?: {
    id?: string | number;
    name?: string | null;
    username?: string | null;
    phone_number?: string | null;
  } | null;
  field_mapping?: unknown;
  status_mapping?: unknown;
  status_sync_config?: unknown;
  total_synced_orders: number;
  last_sync_at: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type IntegrationParams = {
  is_active?: string;
  status?: string;
  market_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
};

export type CreateIntegrationPayload = {
  name: string;
  slug: string;
  type: string;
  status: string;
  base_url: string;
  auth_type: string;
  credentials: Record<string, string>;
  market_id?: string | null;
  is_active?: boolean;
  field_mapping?: unknown;
  status_mapping?: unknown;
  status_sync_config?: unknown;
};

export type UpdateIntegrationPayload = Partial<CreateIntegrationPayload>;

export type IntegrationsMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type IntegrationsResponse = {
  statusCode: number;
  message: string;
  data: {
    items: Integration[];
    market: unknown | null;
    markets: unknown[];
    meta: IntegrationsMeta;
  };
};

export const integrationKeys = {
  all: ["integrations"] as const,
  list: (params: IntegrationParams) => ["integrations", params] as const,
  byId: (id: string | number) => ["integrations", "by-id", id] as const,
};

export const getIntegrationErrorMessage = (err: unknown): string => {
  const axiosErr = err as AxiosError<{ message?: unknown; error?: unknown }>;
  const msg = axiosErr?.response?.data?.message ?? axiosErr?.response?.data?.error;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map(String).join(", ");
  return "";
};

export const useGetIntegrations = (params: IntegrationParams) =>
  useQuery<IntegrationsResponse>({
    queryKey: integrationKeys.list(params),
    queryFn: () =>
      api.get(API_ENDPOINTS.INTEGRATIONS.BASE, { params }).then((res) => res.data),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

export type IntegrationByIdResponse = {
  statusCode: number;
  message: string;
  data: Integration;
};

export const useGetIntegrationById = (id?: string | number) =>
  useQuery<IntegrationByIdResponse>({
    queryKey: integrationKeys.byId(id ?? ""),
    queryFn: () =>
      api.get(API_ENDPOINTS.INTEGRATIONS.BY_ID(id as string | number)).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

export const useCreateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateIntegrationPayload) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.BASE, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
};

export const useDeleteIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) =>
      api.delete(API_ENDPOINTS.INTEGRATIONS.BY_ID(id)).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
};

export const useUpdateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: UpdateIntegrationPayload }) =>
      api.patch(API_ENDPOINTS.INTEGRATIONS.BY_ID(id), payload).then((res) => res.data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
      queryClient.invalidateQueries({ queryKey: integrationKeys.byId(variables.id) });
    },
  });
};
