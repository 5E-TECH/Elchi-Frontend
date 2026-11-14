import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

/** Viloyat (tumanlari bilan) — tanlov ro'yxatlari uchun (`GET region`). */
export type RegionOption = {
  id: string;
  name: string;
  districts?: Array<{ id: string; name: string }>;
};

/** `GET region` javobi — massiv `data`, `data.data`, `data.items` yoki `items` ichida bo'lishi mumkin. */
export const extractRegionOptions = (payload: unknown): RegionOption[] => {
  const response = payload as {
    data?: RegionOption[] | { data?: RegionOption[]; items?: RegionOption[] };
    items?: RegionOption[];
  };

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray((response?.data as { data?: RegionOption[] } | undefined)?.data)) {
    return (response.data as { data: RegionOption[] }).data;
  }
  if (Array.isArray((response?.data as { items?: RegionOption[] } | undefined)?.items)) {
    return (response.data as { items: RegionOption[] }).items;
  }
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

/**
 * Viloyatlar ro'yxati (massiv) — «Yangi filial» oynasi, kuryerning «Xizmat viloyatlari» oynasi. Kalit
 * `queryKeys.regions.options` — `["regions"]` ostida XOM javob saqlaydigan hooklardan alohida (bitta kalitda ikki
 * shakl bo'lmasin).
 */
export const useRegionOptions = (options?: { enabled?: boolean; silentError?: boolean }) =>
  useQuery({
    queryKey: queryKeys.regions.options,
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.REGIONS.BASE);
      return extractRegionOptions(response.data);
    },
    enabled: options?.enabled ?? true,
    ...(options?.silentError ? { meta: { silentError: true } } : {}),
  });
