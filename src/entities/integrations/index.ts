import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export type Integration = {
  id: string;
  name: string;
  slug: string;
  api_url: string;
  auth_type: string;
  is_active: boolean;
  market_id: string | null;
  total_synced_orders: number;
  last_sync_at: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationParams = {
  is_active?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
};

type IntegrationResponse = {
  statusCode: number;
  message: string;
  data: Integration[];
};

export const integrationKeys = {
  all: ["integrations"] as const,
  list: (params: IntegrationParams) => ["integrations", params] as const,
};

export const useGetIntegrations = (params: IntegrationParams) =>
  useQuery<IntegrationResponse>({
    queryKey: integrationKeys.list(params),
    queryFn: () =>
      api.get(API_ENDPOINTS.INTEGRATIONS.BASE, { params }).then((res) => res.data),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
