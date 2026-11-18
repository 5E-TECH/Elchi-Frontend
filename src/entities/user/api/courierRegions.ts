import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";

/**
 * KURYERNING «XIZMAT VILOYATLARI» (super-kuryer, hEjjuJaT) — `GET / PUT couriers/:id/regions`, faqat superadmin va
 * admin. Ega qarori 2026-11-15: HQ kuryeri shu viloyatlar pochtasida «HQ kuryeriga» ro'yxatida chiqadi
 * (`GET branches/posts/:id/courier-destinations` → `region_match: listed`; `serves_all_regions` — har viloyatda).
 * Ro'yxat bilan birga viloyat tariflari ham saqlanadi (yo'q bo'lsa — kuryerning umumiy tarifi).
 */
export interface CourierRegionEntry {
  region_id: string;
  tariff_home: number | null;
  tariff_center: number | null;
}

export interface CourierRegionsView {
  courier_id: string;
  home_region_id: string | null;
  is_super_courier: boolean;
  serves_all_regions: boolean;
  flat_tariff_home: number | null;
  flat_tariff_center: number | null;
  regions: CourierRegionEntry[];
}

export interface SetCourierRegionsDto {
  is_super_courier: boolean;
  serves_all_regions: boolean;
  regions: CourierRegionEntry[];
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const numOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** `{ statusCode, data: {…} }` yoki o'ramsiz javob → `CourierRegionsView`. */
export const readCourierRegions = (payload: unknown, courierId: string): CourierRegionsView => {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : root) as Record<
    string,
    unknown
  >;
  const regions = (Array.isArray(data.regions) ? data.regions : [])
    .map((raw) => {
      const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        region_id: text(row.region_id),
        tariff_home: numOrNull(row.tariff_home),
        tariff_center: numOrNull(row.tariff_center),
      };
    })
    .filter((row) => row.region_id !== "");
  return {
    courier_id: text(data.courier_id) || courierId,
    home_region_id: text(data.home_region_id) || null,
    is_super_courier: data.is_super_courier === true,
    serves_all_regions: data.serves_all_regions === true,
    flat_tariff_home: numOrNull(data.flat_tariff_home),
    flat_tariff_center: numOrNull(data.flat_tariff_center),
    regions,
  };
};

/**
 * Tanlangan viloyatlar → `PUT` tanasi (ro'yxat TO'LIQ almashtiriladi):
 *  - saqlanib qolgan viloyatning tariflari o'zgarmaydi, yangisiga — `null` (umumiy tarifga fallback, pul o'zgarmaydi);
 *  - `serves_all_regions` GET'dagidek qoladi (bu oynada o'zgartirilmaydi);
 *  - `is_super_courier` — ro'yxat bo'sh bo'lmasa yoki «Barcha viloyatlar» yoqiq bo'lsa (backend
 *    `serves_all_regions` ni faqat super-kuryerga ruxsat beradi); `false` — ro'yxat tozalanadi (oddiy kuryer).
 */
export const buildCourierRegionsPayload = (
  current: CourierRegionsView,
  selectedRegionIds: readonly string[],
): SetCourierRegionsDto => {
  const byId = new Map(current.regions.map((row) => [row.region_id, row]));
  const unique = Array.from(new Set(selectedRegionIds.map((id) => String(id).trim()).filter(Boolean)));
  const regions = unique.map((regionId) => {
    const kept = byId.get(regionId);
    return {
      region_id: regionId,
      tariff_home: kept?.tariff_home ?? null,
      tariff_center: kept?.tariff_center ?? null,
    };
  });
  return {
    is_super_courier: regions.length > 0 || current.serves_all_regions,
    serves_all_regions: current.serves_all_regions,
    regions,
  };
};

export const useCourierRegions = (courierId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.courierRegions.detail(courierId),
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.COURIERS.REGIONS(courierId));
      return readCourierRegions(response.data, courierId);
    },
    enabled: enabled && Boolean(courierId),
    // Sahifa xatoni o'zi ko'rsatadi (kartadagi `ErrorState`) — global xabar takrorlanmaydi.
    meta: { silentError: true },
  });

export const useSetCourierRegions = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ courierId, dto }: { courierId: string; dto: SetCourierRegionsDto }) => {
      const response = await api.put(API_ENDPOINTS.COURIERS.REGIONS(courierId), dto);
      return readCourierRegions(response.data, courierId);
    },
    onSuccess: (view, { courierId }) => {
      client.setQueryData(queryKeys.courierRegions.detail(courierId), view);
      void client.invalidateQueries({ queryKey: queryKeys.courierRegions.all });
      // Viloyatlar kesimidagi kuryerlar soni (`region/stats/*`) super-kuryer viloyatlarini ham sanaydi.
      void client.invalidateQueries({ queryKey: ["region-stats"] });
    },
  });
};
