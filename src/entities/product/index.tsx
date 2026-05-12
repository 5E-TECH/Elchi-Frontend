import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { isInactiveMarketStatus, unwrapMarketPayload } from "../../shared/lib/marketStatus";

export const products = "products";

export const useProducts = () => {
  const client = useQueryClient();

  const createProduct = useMutation({
    mutationFn: async (data: FormData) => {
      const marketId = data.get("market_id");

      if (typeof marketId === "string" && marketId) {
        const marketResponse = await api
          .get(API_ENDPOINTS.MARKETS.BY_ID(marketId))
          .then((res) => res.data);
        const market = unwrapMarketPayload(marketResponse);

        if (isInactiveMarketStatus(market?.status)) {
          throw new Error("Faol emas market uchun yangi mahsulot yaratib bo'lmaydi.");
        }
      }

      return api.post(API_ENDPOINTS.PRODUCTS.BASE, data);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  const getProducts = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [products, params],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BASE, { params }).then((res) => res.data),
      enabled,
      placeholderData: (prev: any) => prev,
    });

  const getProductById = (id: number | undefined, enabled: boolean = true) =>
    useQuery({
      queryKey: [products, "detail", id],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BY_ID(id as number)).then((res) => res.data),
      enabled: Boolean(id) && enabled,
    });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      api.patch(API_ENDPOINTS.PRODUCTS.BY_ID(id), data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  // Inside useProducts.ts
  const getByMarketId = (id: string | undefined, enabled?: boolean) => {
    return useQuery({
      queryKey: ["market", id],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(id as string)).then((res) => res.data), // or however you fetch
      enabled: !!id && enabled !== false, // Only fetch if ID exists
    });
  };

  const getMyProducts = (enabled: boolean = true) =>
    useQuery({
      queryKey: [products, "my-products"],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS).then((res) => res.data),
      enabled,
    });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(API_ENDPOINTS.PRODUCTS.BY_ID(id)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
    },
  });

  return {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getByMarketId,
    getMyProducts,
  };
};
