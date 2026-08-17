import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

export const REGION_KEY = "regions";
export const DISTRICT_KEY = "districts";

export const useLogistics = () => {
    const useGetRegions = () =>
        useQuery({
            queryKey: [REGION_KEY],
            queryFn: () => api.get(API_ENDPOINTS.REGIONS.BASE).then((res) => res.data),
            staleTime: 5 * 60 * 1000,
        });

    const useGetDistricts = (regionId?: string) =>
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
            enabled: !!regionId,
        });

    return { useGetRegions, useGetDistricts };
};
