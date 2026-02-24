import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";

export const REGION_KEY = "regions";
export const DISTRICT_KEY = "districts";

export const useLogistics = () => {
    const getRegions = () =>
        useQuery({
            queryKey: [REGION_KEY],
            queryFn: () => api.get("region").then((res) => res.data),
            staleTime: 5 * 60 * 1000, // 5 daqiqa cache
        });

    const getDistricts = (regionId?: string) =>
        useQuery({
            queryKey: [DISTRICT_KEY, regionId],
            queryFn: () =>
                api.get("district", { params: { region_id: regionId } }).then((res) => res.data),
            enabled: !!regionId,
        });

    return { getRegions, getDistricts };
};
