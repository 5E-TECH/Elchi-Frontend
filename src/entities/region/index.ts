import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * Region (hudud) statistikasi — markaziy data-layer.
 *
 * Region sahifasi ham, Dashboard hudud widgeti ham SHU modulni ishlatadi
 * (takror normalizatsiya kodidan qochish uchun). Backend `region/stats/all`
 * turli kalit nomlarida qaytarishi mumkin, shuning uchun moslashuvchan parser.
 */

export interface RegionStats {
  districtCount: number;
  activeCouriers: number;
  orderCount: number;
  deliveredOrders?: number;
  cancelledOrders?: number;
  pendingOrders?: number;
  totalRevenue?: number;
  successRate?: number;
}

/** Flat ko'rinish (ichki normallashtirilgan). */
export interface RegionItem {
  id: string;
  name: string;
  districtCount: number;
  activeCouriers: number;
  ordersCount: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  successRate: number;
}

/** UzbekistanRegionMap kutadigan ko'rinish. */
export interface RegionMapItem {
  id: string;
  name: string;
  stats: RegionStats;
}

export interface RegionSummary {
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  totalRevenue: number;
}

export interface DistrictStatsItem {
  id: string;
  name: string;
  satoCode?: string;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  successRate: number;
  revenue: number;
  activeCouriers: number;
}

export interface RegionDetailStats {
  id: string;
  name: string;
  summary: RegionSummary & {
    pendingOrders: number;
    activeCouriers: number;
    successRate: number;
  };
  districts: DistrictStatsItem[];
}

export interface DistrictCatalogItem {
  id: string;
  name: string;
  satoCode?: string;
  regionId?: string;
}

export const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeRegionItem = (raw: unknown): RegionItem | null => {
  const item = raw as Record<string, unknown>;
  const stats = asRecord(item.stats);
  const id = item?.id ?? item?.regionId ?? item?.region_id;
  const name = item?.name ?? item?.regionName ?? item?.region_name;
  if (!id || !name) return null;

  return {
    id: String(id),
    name: String(name),
    districtCount: toNumber(
      item.districtCount ?? item.district_count ?? item.districtsCount ?? item.districts_count,
    ),
    activeCouriers: toNumber(
      item.activeCouriers ?? item.active_couriers ?? stats.activeCouriers ?? stats.active_couriers,
    ),
    ordersCount: toNumber(
      item.ordersCount ??
        item.orders_count ??
        item.orderCount ??
        item.order_count ??
        item.totalOrders ??
        item.total_orders ??
        item.totalOrderCount ??
        item.total_order_count ??
        item.allOrders ??
        item.all_orders ??
        stats.totalOrders ??
        stats.total_orders ??
        stats.ordersCount ??
        stats.orders_count,
    ),
    deliveredOrders: toNumber(
      item.deliveredOrders ?? item.delivered_orders ?? stats.deliveredOrders ?? stats.delivered_orders,
    ),
    cancelledOrders: toNumber(
      item.cancelledOrders ?? item.cancelled_orders ?? stats.cancelledOrders ?? stats.cancelled_orders,
    ),
    pendingOrders: toNumber(
      item.pendingOrders ?? item.pending_orders ?? stats.pendingOrders ?? stats.pending_orders,
    ),
    totalRevenue: toNumber(
      item.totalRevenue ?? item.total_revenue ?? item.revenue ?? stats.totalRevenue ?? stats.total_revenue,
    ),
    successRate: toNumber(
      item.successRate ?? item.success_rate ?? stats.successRate ?? stats.success_rate,
    ),
  };
};

export const unwrapRegions = (payload: unknown): RegionItem[] => {
  const data = payload as {
    data?: unknown[] | { data?: unknown[]; items?: unknown[]; regions?: unknown[] };
    items?: unknown[];
    regions?: unknown[];
  };
  const arr = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.regions)
        ? data.regions
        : Array.isArray((data?.data as { regions?: unknown[] })?.regions)
          ? (data.data as { regions: unknown[] }).regions
          : Array.isArray((data?.data as { items?: unknown[] })?.items)
            ? (data.data as { items: unknown[] }).items
            : Array.isArray((data?.data as { data?: unknown[] })?.data)
              ? (data.data as { data: unknown[] }).data
              : [];

  return arr
    .map(normalizeRegionItem)
    .filter((region): region is RegionItem => Boolean(region));
};

export const normalizeSummary = (payload: unknown): RegionSummary => {
  const data = payload as { summary?: unknown; data?: { summary?: unknown } };
  const summary = (data?.summary ?? data?.data?.summary ?? {}) as Record<string, unknown>;
  return {
    totalOrders: toNumber(
      summary.totalOrders ?? summary.total_orders ?? summary.ordersCount ?? summary.orders_count,
    ),
    totalDelivered: toNumber(
      summary.totalDelivered ??
        summary.total_delivered ??
        summary.deliveredOrders ??
        summary.delivered_orders,
    ),
    totalCancelled: toNumber(
      summary.totalCancelled ??
        summary.total_cancelled ??
        summary.cancelledOrders ??
        summary.cancelled_orders,
    ),
    totalRevenue: toNumber(summary.totalRevenue ?? summary.total_revenue ?? summary.revenue),
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const unwrapRegionDetail = (payload: unknown) => {
  const response = asRecord(payload);
  const firstData = asRecord(response.data);
  const secondData = asRecord(firstData.data);

  return Object.keys(secondData).length
    ? secondData
    : Object.keys(firstData).length
      ? firstData
      : response;
};

const normalizeDistrictStatsItem = (raw: unknown, index: number): DistrictStatsItem => {
  const item = asRecord(raw);
  const stats = asRecord(item.stats);
  const totalOrders = toNumber(
    item.totalOrders ??
      item.total_orders ??
      item.ordersCount ??
      item.orders_count ??
      item.orderCount ??
      item.order_count ??
      stats.totalOrders ??
      stats.total_orders ??
      stats.ordersCount ??
      stats.orders_count,
  );
  const deliveredOrders = toNumber(
    item.deliveredOrders ??
      item.delivered_orders ??
      item.delivered ??
      item.sold ??
      stats.deliveredOrders ??
      stats.delivered_orders ??
      stats.delivered ??
      stats.sold,
  );
  const cancelledOrders = toNumber(
    item.cancelledOrders ??
      item.cancelled_orders ??
      item.cancelled ??
      item.canceled ??
      stats.cancelledOrders ??
      stats.cancelled_orders ??
      stats.cancelled ??
      stats.canceled,
  );
  const rawPending = toNumber(
    item.pendingOrders ??
      item.pending_orders ??
      item.pending ??
      item.waiting ??
      stats.pendingOrders ??
      stats.pending_orders ??
      stats.pending ??
      stats.waiting,
  );
  const pendingOrders =
    rawPending > 0 ? rawPending : Math.max(totalOrders - deliveredOrders - cancelledOrders, 0);
  const successRate =
    toNumber(item.successRate ?? item.success_rate) ||
    (totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0);

  return {
    id: String(item.id ?? item.district_id ?? item.districtId ?? index + 1),
    name: String(item.name ?? item.districtName ?? item.district_name ?? ""),
    satoCode: item.sato_code || item.satoCode ? String(item.sato_code ?? item.satoCode) : undefined,
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    pendingOrders,
    successRate,
    revenue: toNumber(
      item.revenue ??
        item.totalRevenue ??
        item.total_revenue ??
        item.income ??
        stats.revenue ??
        stats.totalRevenue ??
        stats.total_revenue ??
        stats.income,
    ),
    activeCouriers: toNumber(
      item.activeCouriers ??
        item.active_couriers ??
        (Array.isArray(item.couriers) ? item.couriers.length : 0),
    ),
  };
};

export const normalizeRegionDetailStats = (payload: unknown): RegionDetailStats => {
  const source = unwrapRegionDetail(payload);
  const summary = asRecord(source.summary);
  const region = asRecord(source.region);
  const stats = asRecord(source.stats);
  const statsSummary = asRecord(stats.summary);
  const effectiveSummary =
    Object.keys(summary).length > 0 ? summary : statsSummary;
  const districtsSource = Array.isArray(source.districts)
    ? source.districts
    : Array.isArray(source.tumanlar)
      ? source.tumanlar
      : Array.isArray(source.districtStats)
        ? source.districtStats
        : Array.isArray(stats.districts)
          ? stats.districts
          : [];
  const districts = districtsSource.map(normalizeDistrictStatsItem);
  const summaryOrders = toNumber(
    effectiveSummary.totalOrders ??
      effectiveSummary.total_orders ??
      effectiveSummary.ordersCount ??
      effectiveSummary.orders_count ??
      source.totalOrders ??
      source.ordersCount ??
      source.orders_count,
  );
  const totalOrders =
    summaryOrders || districts.reduce((sum, district) => sum + district.totalOrders, 0);
  const totalDelivered =
    toNumber(effectiveSummary.totalDelivered ?? effectiveSummary.total_delivered ?? effectiveSummary.deliveredOrders ?? effectiveSummary.delivered_orders) ||
    districts.reduce((sum, district) => sum + district.deliveredOrders, 0);
  const totalCancelled =
    toNumber(effectiveSummary.totalCancelled ?? effectiveSummary.total_cancelled ?? effectiveSummary.cancelledOrders ?? effectiveSummary.cancelled_orders) ||
    districts.reduce((sum, district) => sum + district.cancelledOrders, 0);
  const pendingOrders =
    toNumber(effectiveSummary.pendingOrders ?? effectiveSummary.pending_orders) ||
    districts.reduce((sum, district) => sum + district.pendingOrders, 0);
  const totalRevenue =
    toNumber(effectiveSummary.totalRevenue ?? effectiveSummary.total_revenue ?? effectiveSummary.revenue) ||
    districts.reduce((sum, district) => sum + district.revenue, 0);
  const activeCouriers =
    toNumber(effectiveSummary.activeCouriers ?? effectiveSummary.active_couriers) ||
    districts.reduce((sum, district) => sum + district.activeCouriers, 0);
  const successRate =
    toNumber(effectiveSummary.successRate ?? effectiveSummary.success_rate) ||
    (totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0);

  return {
    id: String(region.id ?? source.id ?? source.region_id ?? stats.region_id ?? ""),
    name: String(region.name ?? source.name ?? source.region_name ?? stats.region_name ?? ""),
    summary: {
      totalOrders,
      totalDelivered,
      totalCancelled,
      totalRevenue,
      pendingOrders,
      activeCouriers,
      successRate,
    },
    districts,
  };
};

export const normalizeDistrictCatalog = (payload: unknown): DistrictCatalogItem[] => {
  const response = asRecord(payload);
  const firstData = response.data;
  const firstRecord = asRecord(firstData);
  const secondData = firstRecord.data;
  const source = unwrapRegionDetail(payload);
  const districts =
    [
      payload,
      firstData,
      secondData,
      response.districts,
      response.district,
      response.items,
      firstRecord.districts,
      firstRecord.district,
      firstRecord.items,
      source.districts,
      source.district,
      source.items,
      source.data,
    ].find(Array.isArray) ?? [];

  return districts
    .map((value): DistrictCatalogItem | null => {
      const district = asRecord(value);
      const id = district.id ?? district.district_id ?? district.districtId;
      const name = district.name ?? district.district_name ?? district.districtName;
      if (id == null || !name) return null;

      return {
        id: String(id),
        name: String(name),
        satoCode:
          district.sato_code || district.satoCode
            ? String(district.sato_code ?? district.satoCode)
            : undefined,
        regionId:
          district.region_id || district.regionId
            ? String(district.region_id ?? district.regionId)
            : undefined,
      };
    })
    .filter((district): district is DistrictCatalogItem => Boolean(district));
};

export const mergeRegionDistrictStats = (
  detail: RegionDetailStats | null | undefined,
  catalog: DistrictCatalogItem[],
  region: { id?: string; name?: string } = {},
): RegionDetailStats | null => {
  if (!detail && catalog.length === 0) return null;

  const statsById = new Map(
    (detail?.districts ?? []).map((district) => [district.id, district]),
  );
  const districts = catalog.length
    ? catalog.map((district) => {
        const stats = statsById.get(district.id);
        return {
          id: district.id,
          name: stats?.name || district.name,
          satoCode: stats?.satoCode || district.satoCode,
          totalOrders: stats?.totalOrders ?? 0,
          deliveredOrders: stats?.deliveredOrders ?? 0,
          cancelledOrders: stats?.cancelledOrders ?? 0,
          pendingOrders: stats?.pendingOrders ?? 0,
          successRate: stats?.successRate ?? 0,
          revenue: stats?.revenue ?? 0,
          activeCouriers: stats?.activeCouriers ?? 0,
        };
      })
    : detail?.districts ?? [];

  return {
    id: detail?.id || region.id || "",
    name: detail?.name || region.name || "",
    summary: detail?.summary ?? {
      totalOrders: 0,
      totalDelivered: 0,
      totalCancelled: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      activeCouriers: 0,
      successRate: 0,
    },
    districts,
  };
};

/** Flat RegionItem[] → xarita kutadigan {id, name, stats}[]. */
export const toRegionMapItems = (regions: RegionItem[]): RegionMapItem[] =>
  regions.map((r) => ({
    id: r.id,
    name: r.name,
    stats: {
      districtCount: r.districtCount,
      activeCouriers: r.activeCouriers,
      orderCount: r.ordersCount,
      deliveredOrders: r.deliveredOrders,
      cancelledOrders: r.cancelledOrders,
      pendingOrders: r.pendingOrders,
      totalRevenue: r.totalRevenue,
      successRate: r.successRate,
    },
  }));

/** Hudud statistikasini olib, normallashtirilgan holda qaytaruvchi hook. */
export const useRegionStats = (
  params?: { startDate?: string; endDate?: string },
  enabled = true,
) =>
  useQuery({
    queryKey: ["region-stats", params],
    queryFn: async () => {
      const res = await api.get(API_ENDPOINTS.REGIONS.STATS_ALL, { params });
      const detail = normalizeRegionDetailStats(res.data);
      return {
        regions: unwrapRegions(res.data),
        summary: normalizeSummary(res.data),
        scopedDetail:
          detail.id || detail.name || detail.districts.length > 0
            ? detail
            : null,
      };
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useRegionDetailStats = (
  regionId: string,
  params?: { startDate?: string; endDate?: string; courier_id?: string; branch_id?: string },
  enabled = true,
) =>
  useQuery({
    queryKey: ["region-stats", "detail", regionId, params],
    queryFn: async () => {
      const res = await api.get(API_ENDPOINTS.REGIONS.STATS_BY_ID(regionId), { params });
      return normalizeRegionDetailStats(res.data);
    },
    enabled: enabled && Boolean(regionId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useRegionDistrictCatalog = (
  regionId: string,
  enabled = true,
) =>
  useQuery({
    queryKey: ["region-district-catalog", regionId],
    queryFn: async () => {
      const res = await api.get(API_ENDPOINTS.DISTRICTS.BASE, {
        params: { region_id: regionId },
      });
      return normalizeDistrictCatalog(res.data).filter(
        (district) => !district.regionId || district.regionId === regionId,
      );
    },
    enabled: enabled && Boolean(regionId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
