import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const products = "products";

type ProductQueryParams = Record<string, unknown>;

/**
 * `GET /product/market/:id` va `/product/my-products` dagi `limit` ning yuqori chegarasi (gateway
 * `PRODUCT_LIST_MAX_LIMIT`). `limit` berilmasa server sukuti 10 — 11-mahsulot ro'yxatda hech qachon chiqmasdi
 * (buyurtma yaratish katalogi, D-20).
 */
export const PRODUCT_LIST_MAX_LIMIT = 500;

/** Katalog ro'yxati parametrlari (`search`, `page`, `limit` — gateway `buildProductListQuery`). */
export type ProductListParams = { search?: string; page?: number; limit?: number };

/**
 * Ro'yxat so'rovi sozlamalari (ixtiyoriy, berilmasa xulq avvalgidek):
 * `keepPreviousData` — sahifa/qidiruv almashganda yangi javob kelguncha eski qatorlar qoladi;
 * `silentError` — sahifa xatoni o'zi ko'rsatadi (`ErrorState`), global xabar takrorlanmaydi.
 */
export type ProductListQueryOptions = { keepPreviousData?: boolean; silentError?: boolean };

const listQueryExtras = (options?: ProductListQueryOptions) => ({
  ...(options?.keepPreviousData ? { placeholderData: keepPreviousData } : {}),
  ...(options?.silentError ? { meta: { silentError: true } } : {}),
});

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

  const useGetProducts = (
    params?: ProductQueryParams,
    enabled: boolean = true,
    options?: Pick<ProductListQueryOptions, "silentError">,
  ) =>
    useQuery({
      queryKey: [products, params],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BASE, { params }).then((res) => res.data),
      enabled,
      placeholderData: (previousData) => previousData,
      ...listQueryExtras(options),
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

  /**
   * `GET /product/market/:marketId` va `GET /product/my-products` `search` / `page` / `limit` (≤ 500) ni qabul
   * qiladi (3qDsJpfW). `params` — ixtiyoriy (berilmasa kalit va so'rov avvalgidek, server sukuti: 1-sahifa,
   * 10 ta); berilsa `queryKey` ga ham kiradi. `["market"]` / `[products]` bekor qilishlari ikkalasiga ham tegadi.
   * Eski sahifa ko'rinib turishi (`keepPreviousData`) — faqat `options` bilan (sahifalangan ro'yxat): market
   * almashadigan katalogda (buyurtma yaratish) avvalgi marketning mahsulotlari ko'rinib qolmasin.
   */
  const useGetByMarketId = (
    id: string | undefined,
    enabled?: boolean,
    params?: ProductListParams,
    options?: ProductListQueryOptions,
  ) => {
    return useQuery({
      queryKey: params ? ["market", id, params] : ["market", id],
      queryFn: () =>
        (params
          ? api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(id as string), { params })
          : api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(id as string))
        ).then((res) => res.data),
      enabled: !!id && enabled !== false, // Only fetch if ID exists
      ...listQueryExtras(options),
    });
  };

  const useGetMyProducts = (enabled: boolean = true, params?: ProductListParams, options?: ProductListQueryOptions) =>
    useQuery({
      queryKey: params ? [products, "my-products", params] : [products, "my-products"],
      queryFn: () =>
        (params ? api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS, { params }) : api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS)).then(
          (res) => res.data,
        ),
      enabled,
      ...listQueryExtras(options),
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
    deleteProduct,
    useGetByMarketId,
    useGetMyProducts,
  };
};
