import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { unwrapRegions } from "./index";

/** Tanlov ro'yxati uchun viloyat: faqat `id` va nom. */
export interface RegionLookupItem {
  id: string;
  name: string;
}

export const REGION_LOOKUP_KEY = ["region-lookup"] as const;

const toLookup = (payload: unknown): RegionLookupItem[] =>
  unwrapRegions(payload).map(({ id, name }) => ({ id, name }));

/**
 * Viloyatlar ro'yxati (`GET /region`) — forma va filtrlardagi `Select` uchun (KM-1 «Mijoz filtrlari»).
 * Tumanlar — `useRegionDistrictCatalog(regionId)`. Xatoni iste'molchi o'zi ko'rsatadi (global xabar yo'q).
 */
export const useRegionLookup = (enabled = true) =>
  useQuery({
    queryKey: REGION_LOOKUP_KEY,
    queryFn: async () => toLookup((await api.get(API_ENDPOINTS.REGIONS.BASE)).data),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
