import { useQuery } from "@tanstack/react-query";
import { products } from "../../../entities/product";
import { API_ENDPOINTS } from "../../../shared/api";
import { api } from "../../../shared/api/api";

/**
 * KATALOG RO'YXATLARI `search` / `page` / `limit` BILAN — `GET product/my-products` (market) va
 * `GET product/market/:id` (xodim, yaratish sahifasi).
 *
 * Nega sahifaning o'zida: backend `origin/main` (3qDsJpfW, `buildProductListQuery`) ikkala marshrutda ham
 * `search`, `page`, `limit` (≤ 500) ni qabul qiladi; parametrsiz so'rovda server sukuti `limit = 10` — 11-mahsulot
 * hech qachon ko'rinmasdi, market qidiruvi va sahifalashi ishlamasdi. `entities/product` dagi `useGetMyProducts` /
 * `useGetByMarketId` hozircha parametr olmaydi (u faylga boshqa ish tegmoqda — bu ish uni o'zgartirmaydi).
 * Kalitlar o'sha hook'larning parametrli ko'rinishi bilan bir xil (`[products, "my-products", params]`,
 * `["market", id, params]`) — mahsulot mutatsiyalaridagi `[products]` / `["market"]` bekor qilishlari ularni ham
 * yangilaydi. `entities/product` ga `params` qo'shilgach, ikkala hook o'shalar bilan almashtiriladi.
 */

/** Gateway `PRODUCT_LIST_MAX_LIMIT` — yaratish sahifasidagi ro'yxat (sahifalashsiz, maket) bitta so'rovda. */
export const PRODUCT_LIST_MAX_LIMIT = 500;

export type ProductListParams = { search?: string; page?: number; limit?: number };

/** Market roli: o'z mahsulotlari (`GET product/my-products`). */
export const useMyProductsList = (params: ProductListParams, enabled: boolean) =>
  useQuery({
    queryKey: [products, "my-products", params],
    queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS, { params }).then((res) => res.data),
    enabled,
    placeholderData: (previous) => previous,
  });

/** Xodim: tanlangan market mahsulotlari (`GET product/market/:id`). */
export const useMarketProductsList = (marketId: string | undefined, params: ProductListParams, enabled: boolean) =>
  useQuery({
    queryKey: ["market", marketId, params],
    queryFn: () =>
      api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(marketId as string), { params }).then((res) => res.data),
    enabled: Boolean(marketId) && enabled,
  });
