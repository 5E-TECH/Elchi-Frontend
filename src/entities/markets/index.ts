import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

export const markets = "markets";

export const useMarkets = () => {
  const client = useQueryClient();

  const createMarket = useMutation({
    mutationFn: (data: any) => api.post("markets", data),
    onSuccess: () => client.invalidateQueries({ queryKey: [markets] }),
  });

  const getMarkets = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [markets, params],
      queryFn: () => api.get("markets", { params }).then((res) => res.data),
      enabled,
    });

  return {
    createMarket,
    getMarkets,
  };
};
