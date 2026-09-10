import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * Hamkor tizimlardan (BeePost va h.k.) kelgan buyurtmalar.
 *
 * Backend `GET /orders/external` — `source = external` bo'yicha filtrlangan
 * odatdagi buyurtma ro'yxati. Hamkor Partner API orqali posilka yaratganda
 * buyurtma shu ro'yxatda `new` holatida paydo bo'ladi va HQ operatori uni
 * skanerlab tizimga qabul qiladi.
 *
 * Rollar (gateway guardi): SUPERADMIN · ADMIN · REGISTRATOR · MARKET.
 */
export type IncomingOrder = {
  id: string;
  order_number?: number | null;
  status?: string | null;
  total_price?: number | null;
  qr_code_token?: string | null;
  /** Hamkor tomonidagi buyurtma id'si (bizga `external_id` bo'lib keladi). */
  external_id?: string | null;
  customer?: {
    name?: string | null;
    phone_number?: string | null;
    district?: { name?: string | null } | null;
  } | null;
  district?: { name?: string | null } | null;
  market?: { name?: string | null } | null;
};

export type IncomingOrdersParams = {
  status?: string | string[];
  market_id?: string;
  page?: number;
  limit?: number;
};

export const incomingOrdersKey = "incoming-external-orders";

export const useIncomingExternalOrders = (params?: IncomingOrdersParams) =>
  useQuery({
    queryKey: [incomingOrdersKey, params],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.EXTERNAL, { params })
        .then((res) => res.data),
  });

/**
 * Ro'yxatni javob qobig'idan ochib oladi.
 *
 * Qobiq qatlamlarga qarab farq qiladi (`data.data.items` / `data.items` /
 * to'g'ridan-to'g'ri massiv), shu bois HIMOYALANGAN ochish — bir qatlam
 * o'zgarsa sahifa bo'sh ko'rinib qolmasin.
 */
export const extractIncomingOrders = (raw: unknown): IncomingOrder[] => {
  const candidates = [
    (raw as { data?: { items?: unknown } })?.data?.items,
    (raw as { data?: unknown })?.data,
    (raw as { items?: unknown })?.items,
    raw,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as IncomingOrder[];
  }
  return [];
};

/** Sahifalash meta'si (bo'lmasa `undefined`). */
export const extractMeta = (
  raw: unknown,
): { page?: number; limit?: number; total?: number } | undefined =>
  (raw as { data?: { meta?: { page?: number; limit?: number; total?: number } } })
    ?.data?.meta;
