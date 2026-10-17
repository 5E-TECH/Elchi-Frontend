import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const products = "products";

type ProductQueryParams = Record<string, unknown>;

export const useProducts = () => {
  const client = useQueryClient();

  const createProduct = useMutation({
    mutationFn: (data: FormData) =>
      api.post(API_ENDPOINTS.PRODUCTS.BASE, data, { timeout: LONG_REQUEST_TIMEOUT_MS }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  const useGetProducts = (params?: ProductQueryParams, enabled: boolean = true) =>
    useQuery({
      queryKey: [products, params],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BASE, { params }).then((res) => res.data),
      enabled,
      placeholderData: (previousData) => previousData,
    });

  const useGetProductById = (id: number | undefined, enabled: boolean = true) =>
    useQuery({
      queryKey: [products, "detail", id],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BY_ID(id as number)).then((res) => res.data),
      enabled: Boolean(id) && enabled,
    });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      api.patch(API_ENDPOINTS.PRODUCTS.BY_ID(id), data, { timeout: LONG_REQUEST_TIMEOUT_MS }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  const updateMyProduct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      api.patch(API_ENDPOINTS.PRODUCTS.UPDATE_MY(id), data, { timeout: LONG_REQUEST_TIMEOUT_MS }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  /**
   * `GET /product/market/:marketId` va `GET /product/my-products` `search` / `page` / `limit` (≤ 500) ni qabul
   * qiladi (3qDsJpfW). `params` berilmasa — avvalgidek (server sukuti: 1-sahifa, 10 ta); berilsa `queryKey` ga
   * ham kiradi va keyingi sahifa yuklanguncha oldingisi ko'rinib turadi.
   */
  const useGetByMarketId = (id: string | undefined, enabled?: boolean, params?: ProductQueryParams) => {
    return useQuery({
      queryKey: params ? ["market", id, params] : ["market", id],
      queryFn: () =>
        (params
          ? api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(id as string), { params })
          : api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(id as string))
        ).then((res) => res.data),
      enabled: !!id && enabled !== false, // Only fetch if ID exists
      ...(params ? { placeholderData: keepPreviousData } : {}),
    });
  };

  const useGetMyProducts = (enabled: boolean = true, params?: ProductQueryParams) =>
    useQuery({
      queryKey: params ? [products, "my-products", params] : [products, "my-products"],
      queryFn: () =>
        (params
          ? api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS, { params })
          : api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS)
        ).then((res) => res.data),
      enabled,
      ...(params ? { placeholderData: keepPreviousData } : {}),
    });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(API_ENDPOINTS.PRODUCTS.BY_ID(id)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
    },
  });

  return {
    createProduct,
    useGetProducts,
    useGetProductById,
    updateProduct,
    updateMyProduct,
    deleteProduct,
    useGetByMarketId,
    useGetMyProducts,
  };
};
