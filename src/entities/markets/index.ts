import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const markets = "markets";

export const useMarkets = () => {
  const client = useQueryClient();

  const createMarket = useMutation({
    mutationFn: (data: any) => api.post(API_ENDPOINTS.MARKETS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [markets] }),
  });

  const getMarkets = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [markets, params],
      queryFn: () => api.get(API_ENDPOINTS.MARKETS.BASE, { params }).then((res) => res.data),
      enabled,
    });

    const getMarketById = (id: number, enabled: boolean = true) => useQuery({
      queryKey: [markets, id],
      queryFn: () => api.get(API_ENDPOINTS.MARKETS.BY_ID(id)).then((res) => res.data),
      enabled,
    })

  return {
    createMarket,
    getMarkets,
    getMarketById,
  };
};
