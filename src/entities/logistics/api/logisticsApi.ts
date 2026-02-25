import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";

export const REGION_KEY = "regions";
export const DISTRICT_KEY = "districts";

export const useLogistics = () => {
    const getRegions = () =>
        useQuery({
            queryKey: [REGION_KEY],
            queryFn: () => api.get("region").then((res) => res.data),
            staleTime: 5 * 60 * 1000,
        });

    const getDistricts = (regionId?: string) =>
        useQuery({
            queryKey: [DISTRICT_KEY, regionId],
            queryFn: () =>
                api.get(`region/${regionId}`).then((res) => {
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

    return { getRegions, getDistricts };
};
