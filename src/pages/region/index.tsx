import { memo, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";
import HeaderName from "../../shared/components/headerName";
import { useLogistics } from "../../entities/logistics/api/logisticsApi";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import UzbekistanRegionMap from "./ui/UzbekistanRegionMap";

interface RegionItem {
  id: string;
  name: string;
  districts?: unknown[];
  district?: unknown[];
}

interface DistrictItem {
  id: string;
  name: string;
  sato_code?: string;
}

const toArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray((value as { data?: unknown[] })?.data)) {
    return (value as { data: T[] }).data;
  }
  if (Array.isArray((value as { items?: unknown[] })?.items)) {
    return (value as { items: T[] }).items;
  }
  if (Array.isArray((value as { data?: { items?: unknown[] } })?.data?.items)) {
    return (value as { data: { items: T[] } }).data.items;
  }
  return [];
};

const getDistrictListFromRegionResponse = (value: unknown): DistrictItem[] => {
  if (Array.isArray((value as { districts?: unknown[] })?.districts)) {
    return (value as { districts: DistrictItem[] }).districts;
  }
  if (Array.isArray((value as { district?: unknown[] })?.district)) {
    return (value as { district: DistrictItem[] }).district;
  }
  if (Array.isArray((value as { data?: { districts?: unknown[] } })?.data?.districts)) {
    return (value as { data: { districts: DistrictItem[] } }).data.districts;
  }
  return toArray<DistrictItem>(value);
};

const getTotal = (value: unknown, fallbackLength = 0): number => {
  const candidates = [
    (value as { total?: number })?.total,
    (value as { count?: number })?.count,
    (value as { meta?: { total?: number } })?.meta?.total,
    (value as { data?: { total?: number } })?.data?.total,
    (value as { data?: { meta?: { total?: number } } })?.data?.meta?.total,
  ];

  const total = candidates.find((item) => typeof item === "number");
  return typeof total === "number" ? total : fallbackLength;
};

const Region = () => {
  const { getRegions } = useLogistics();
  const { data: regionsResponse, isLoading, isError } = getRegions();

  const regions = useMemo(
    () => toArray<RegionItem>(regionsResponse).map((region) => ({ ...region, id: String(region.id) })),
    [regionsResponse],
  );

  const regionDetailsQueries = useQueries({
    queries: regions.map((region) => ({
      queryKey: ["region-detail", region.id],
      queryFn: () => api.get(API_ENDPOINTS.REGIONS.BY_ID(region.id)).then((res) => res.data),
      staleTime: 5 * 60 * 1000,
      enabled: regions.length > 0,
    })),
  });

  const courierStatsQueries = useQueries({
    queries: regions.map((region) => ({
      queryKey: ["region-couriers-count", region.id],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.COURIERS.BASE, {
            params: { region_id: region.id, status: "active", page: 1, limit: 1 },
          })
          .then((res) => res.data),
      staleTime: 3 * 60 * 1000,
      enabled: regions.length > 0,
    })),
  });

  const orderStatsQueries = useQueries({
    queries: regions.map((region) => ({
      queryKey: ["region-orders-count", region.id],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.ORDERS.BASE, {
            params: { region_id: region.id, page: 1, limit: 1 },
          })
          .then((res) => res.data),
      staleTime: 3 * 60 * 1000,
      enabled: regions.length > 0,
    })),
  });

  const mappedRegions = useMemo(
    () =>
      regions.map((region, index) => {
        const detailData = regionDetailsQueries[index]?.data;
        const courierData = courierStatsQueries[index]?.data;
        const orderData = orderStatsQueries[index]?.data;

        return {
          id: region.id,
          name: region.name,
          stats: {
            districtCount:
              getDistrictListFromRegionResponse(detailData).length ||
              (Array.isArray(region.districts)
                ? region.districts.length
                : Array.isArray(region.district)
                  ? region.district.length
                  : 0),
            activeCouriers: getTotal(courierData, toArray(courierData).length),
            orderCount: getTotal(orderData, toArray(orderData).length),
          },
        };
      }),
    [courierStatsQueries, orderStatsQueries, regionDetailsQueries, regions],
  );

  return (
    <div className="flex min-h-full flex-col gap-4 rounded-2xl bg-sidebar p-3 sm:p-4 lg:p-6 dark:bg-maindark">
      <div className="rounded-2xl border border-primary/10 bg-primary p-4 shadow-sm dark:border-primarydark dark:bg-maindark">
        <HeaderName
          name="Viloyat Statistikalari"
          description="Viloyatlar xaritasida hover qilsangiz batafsil ma'lumotlar chiqadi"
          icon={<LocateFixed />}
        />
      </div>

      {isLoading ? (
        <div className="h-[38rem] animate-pulse rounded-[2rem] border border-primary/10 bg-primary dark:border-primarydark dark:bg-background" />
      ) : isError ? (
        <div className="rounded-[2rem] border border-primary/10 bg-primary p-6 text-center dark:border-primarydark dark:bg-maindark">
          <p className="text-lg font-bold text-main dark:text-primary">
            Region ma'lumotlarini yuklab bo'lmadi
          </p>
          <p className="mt-2 text-sm text-main/65 dark:text-primary/65">
            Sahifani yangilab qayta urinib ko'ring.
          </p>
        </div>
      ) : (
        <UzbekistanRegionMap regions={mappedRegions} />
      )}
    </div>
  );
};

export default memo(Region);
