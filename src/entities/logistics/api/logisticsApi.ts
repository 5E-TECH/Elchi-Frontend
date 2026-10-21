import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

export const REGION_KEY = "regions";
export const DISTRICT_KEY = "districts";

export const useLogistics = () => {
    /** `enabled` — ixtiyoriy (sukut `true`): `GET /region` ruxsati yo'q rolda (market operatori, N11) so'ralmaydi. */
    const useGetRegions = (enabled: boolean = true) =>
        useQuery({
            queryKey: [REGION_KEY],
            queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => res.data),
            staleTime: 5 * 60 * 1000,
            enabled,
        });

    /** `enabled` — ixtiyoriy (sukut `true`); viloyat tanlanmagan bo'lsa baribir so'ralmaydi. */
    const useGetDistricts = (regionId?: string, enabled: boolean = true) =>
        useQuery({
            queryKey: [DISTRICT_KEY, regionId],
            queryFn: () =>
                api.get(API_ENDPOINTS.REGIONS.BY_ID(regionId as string)).then((res) => {
                    const data = res.data;
                    // Backend javobidan districts/district arrayini topamiz
                    if (Array.isArray(data?.districts)) return data.districts;
                    if (Array.isArray(data?.district)) return data.district;
                    if (Array.isArray(data?.data?.districts)) return data.data.districts;
                    if (Array.isArray(data?.data)) return data.data;
                    return [];
                }),
            enabled: enabled && !!regionId,
        });

    return { useGetRegions, useGetDistricts };
};
