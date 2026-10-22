import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const markets = "markets";

export const useMarkets = () => {
  const client = useQueryClient();

  const createMarket = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.MARKETS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [markets] }),
  });

  const useGetMarkets = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [markets, params],
      queryFn: () => api.get(API_ENDPOINTS.MARKETS.BASE, { params }).then((res) => res.data),
      enabled,
    });

  /** `silentError` — sahifa xatoni o'zi hal qiladi (masalan narxni ko'rsatmaydi), global xabar chiqmaydi. */
  const useGetMarketById = (id: number, enabled: boolean = true, options?: { silentError?: boolean }) => useQuery({
      queryKey: [markets, id],
      queryFn: () => api.get(API_ENDPOINTS.USERS.BY_ID(id)).then((res) => res.data),
      enabled: enabled && Number.isFinite(id) && id > 0,
      ...(options?.silentError ? { meta: { silentError: true } } : {}),
    });

  return {
    createMarket,
    useGetMarkets,
    useGetMarketById,
  };
};
