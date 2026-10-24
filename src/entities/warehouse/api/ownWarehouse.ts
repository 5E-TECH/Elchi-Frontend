import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

/**
 * XtcEyQjb: filial xodimining o'z filialida ombor bormi — `GET /warehouses?limit=1` (backend xodimga faqat o'z filiali
 * omborini qaytaradi). Yengil modul: yon menyu (asosiy chunk) to'liq ombor API'sini (`warehouseApi.ts`) olib kelmasin —
 * javobdan faqat soni o'qiladi.
 */
export const hasWarehousesInPayload = (payload: unknown): boolean => {
  const root = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const inner =
    typeof root.data === "object" && root.data !== null && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const list = Array.isArray(inner.data) ? inner.data : Array.isArray(root.data) ? root.data : [];
  const total = Number(inner.total ?? root.total);
  return list.length > 0 || (Number.isFinite(total) && total > 0);
};

const fetchHasOwnWarehouse = async (): Promise<boolean> => {
  const response = await api.get(API_ENDPOINTS.WAREHOUSES.BASE, { params: { limit: 1 } });
  return hasWarehousesInPayload(response.data);
};

/**
 * `true` — ombor bor, `false` — yo'q (yoki so'rov yiqildi: band ko'rsatilmaydi), `undefined` — hali noma'lum /
 * o'chiq. Ombor kam-kam ochiladi — 5 daqiqa yangi hisoblanadi; ombor yozuvlari `warehouses` keshini yangilaydi.
 */
export const useHasOwnWarehouse = (enabled: boolean): boolean | undefined => {
  const query = useQuery({
    queryKey: queryKeys.warehouses.ownExists,
    queryFn: fetchHasOwnWarehouse,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silentError: true },
  });
  if (!enabled) return undefined;
  if (query.data !== undefined) return query.data;
  return query.isError ? false : undefined;
};
