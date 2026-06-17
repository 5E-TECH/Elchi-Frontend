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

export const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeRegionItem = (raw: unknown): RegionItem | null => {
  const item = raw as Record<string, unknown>;
  const id = item?.id ?? item?.regionId ?? item?.region_id;
  const name = item?.name ?? item?.regionName ?? item?.region_name;
  if (!id || !name) return null;

  return {
    id: String(id),
    name: String(name),
    districtCount: toNumber(
      item.districtCount ?? item.district_count ?? item.districtsCount ?? item.districts_count,
    ),
    activeCouriers: toNumber(item.activeCouriers ?? item.active_couriers),
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
        item.all_orders,
    ),
    deliveredOrders: toNumber(item.deliveredOrders ?? item.delivered_orders),
    cancelledOrders: toNumber(item.cancelledOrders ?? item.cancelled_orders),
    pendingOrders: toNumber(item.pendingOrders ?? item.pending_orders),
    totalRevenue: toNumber(item.totalRevenue ?? item.total_revenue ?? item.revenue),
    successRate: toNumber(item.successRate ?? item.success_rate),
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
  const totalOrders = toNumber(
    item.totalOrders ??
      item.total_orders ??
      item.ordersCount ??
      item.orders_count ??
      item.orderCount ??
      item.order_count,
  );
  const deliveredOrders = toNumber(item.deliveredOrders ?? item.delivered_orders);
  const cancelledOrders = toNumber(item.cancelledOrders ?? item.cancelled_orders);
  const rawPending = toNumber(item.pendingOrders ?? item.pending_orders);
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
    revenue: toNumber(item.revenue ?? item.totalRevenue ?? item.total_revenue),
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
  const districtsSource = Array.isArray(source.districts)
    ? source.districts
    : Array.isArray(source.tumanlar)
      ? source.tumanlar
      : [];
  const districts = districtsSource.map(normalizeDistrictStatsItem);
  const summaryOrders = toNumber(
    summary.totalOrders ??
      summary.total_orders ??
      summary.ordersCount ??
      summary.orders_count ??
      source.totalOrders ??
      source.ordersCount ??
      source.orders_count,
  );
  const totalOrders =
    summaryOrders || districts.reduce((sum, district) => sum + district.totalOrders, 0);
  const totalDelivered =
    toNumber(summary.totalDelivered ?? summary.total_delivered ?? summary.deliveredOrders ?? summary.delivered_orders) ||
    districts.reduce((sum, district) => sum + district.deliveredOrders, 0);
  const totalCancelled =
    toNumber(summary.totalCancelled ?? summary.total_cancelled ?? summary.cancelledOrders ?? summary.cancelled_orders) ||
    districts.reduce((sum, district) => sum + district.cancelledOrders, 0);
  const pendingOrders =
    toNumber(summary.pendingOrders ?? summary.pending_orders) ||
    districts.reduce((sum, district) => sum + district.pendingOrders, 0);
  const totalRevenue =
    toNumber(summary.totalRevenue ?? summary.total_revenue ?? summary.revenue) ||
    districts.reduce((sum, district) => sum + district.revenue, 0);
  const activeCouriers =
    toNumber(summary.activeCouriers ?? summary.active_couriers) ||
    districts.reduce((sum, district) => sum + district.activeCouriers, 0);
  const successRate =
    toNumber(summary.successRate ?? summary.success_rate) ||
    (totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0);

  return {
    id: String(region.id ?? source.id ?? source.region_id ?? ""),
    name: String(region.name ?? source.name ?? source.region_name ?? ""),
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
      return {
        regions: unwrapRegions(res.data),
        summary: normalizeSummary(res.data),
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
