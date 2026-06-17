import { memo, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Calendar, HeadphonesIcon, MapPin, Settings } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../app/config/store";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { parseISODate, toISODate } from "../../shared/lib/dateRange";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import DateRangePicker from "../../shared/ui/DateRangePicker";
import PageContainer from "../../shared/ui/PageContainer";
import UzbekistanRegionMap from "./ui/UzbekistanRegionMap";

type RegionItem = {
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
};

type RegionSummary = {
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  totalRevenue: number;
};

type DateRangeType = "today" | "week" | "month" | "all" | "custom";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRegionItem = (raw: unknown): RegionItem | null => {
  const item = raw as {
    id?: string | number;
    regionId?: string | number;
    region_id?: string | number;
    name?: string;
    regionName?: string;
    region_name?: string;
    districtCount?: number | string;
    district_count?: number | string;
    districts_count?: number | string;
    districtsCount?: number | string;
    activeCouriers?: number | string;
    active_couriers?: number | string;
    ordersCount?: number | string;
    orders_count?: number | string;
    orderCount?: number | string;
    order_count?: number | string;
    totalOrders?: number | string;
    total_orders?: number | string;
    totalOrderCount?: number | string;
    total_order_count?: number | string;
    allOrders?: number | string;
    all_orders?: number | string;
    deliveredOrders?: number | string;
    delivered_orders?: number | string;
    cancelledOrders?: number | string;
    cancelled_orders?: number | string;
    pendingOrders?: number | string;
    pending_orders?: number | string;
    totalRevenue?: number | string;
    total_revenue?: number | string;
    revenue?: number | string;
    successRate?: number | string;
    success_rate?: number | string;
  };

  const id = item?.id ?? item?.regionId ?? item?.region_id;
  const name = item?.name ?? item?.regionName ?? item?.region_name;
  if (!id || !name) return null;

  return {
    id: String(id),
    name,
    districtCount: toNumber(
      item.districtCount ?? item.district_count ?? item.districtsCount ?? item.districts_count,
      0,
    ),
    activeCouriers: toNumber(item.activeCouriers ?? item.active_couriers, 0),
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
      0,
    ),
    deliveredOrders: toNumber(item.deliveredOrders ?? item.delivered_orders, 0),
    cancelledOrders: toNumber(item.cancelledOrders ?? item.cancelled_orders, 0),
    pendingOrders: toNumber(item.pendingOrders ?? item.pending_orders, 0),
    totalRevenue: toNumber(item.totalRevenue ?? item.total_revenue ?? item.revenue, 0),
    successRate: toNumber(item.successRate ?? item.success_rate, 0),
  };
};

const unwrapRegions = (payload: unknown): RegionItem[] => {
  const data = payload as {
    data?:
      | unknown[]
      | {
          data?: unknown[];
          items?: unknown[];
          regions?: unknown[];
        };
    items?: unknown[];
    regions?: unknown[];
  };
  const arrayCandidate = Array.isArray(data?.data)
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

  return arrayCandidate
    .map(normalizeRegionItem)
    .filter((region): region is RegionItem => Boolean(region));
};

const normalizeSummary = (payload: unknown): RegionSummary => {
  const data = payload as {
    summary?: unknown;
    data?: { summary?: unknown };
  };

  const summary = (data?.summary ?? data?.data?.summary ?? {}) as {
    totalOrders?: number | string;
    total_orders?: number | string;
    ordersCount?: number | string;
    orders_count?: number | string;
    totalDelivered?: number | string;
    total_delivered?: number | string;
    deliveredOrders?: number | string;
    delivered_orders?: number | string;
    totalCancelled?: number | string;
    total_cancelled?: number | string;
    cancelledOrders?: number | string;
    cancelled_orders?: number | string;
    totalRevenue?: number | string;
    total_revenue?: number | string;
    revenue?: number | string;
  };

  return {
    totalOrders: toNumber(
      summary.totalOrders ?? summary.total_orders ?? summary.ordersCount ?? summary.orders_count,
      0,
    ),
    totalDelivered: toNumber(
      summary.totalDelivered ?? summary.total_delivered ?? summary.deliveredOrders ?? summary.delivered_orders,
      0,
    ),
    totalCancelled: toNumber(
      summary.totalCancelled ?? summary.total_cancelled ?? summary.cancelledOrders ?? summary.cancelled_orders,
      0,
    ),
    totalRevenue: toNumber(summary.totalRevenue ?? summary.total_revenue ?? summary.revenue, 0),
  };
};

const RegionPage = () => {
  const { t } = useTranslation("region");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { getParam, setMultipleParams, removeParam } = useQueryParams();
  const role = useSelector((state: RootState) => state.role.role);
  const userRegionName = useSelector((state: RootState) => state.role.region);

  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [summary, setSummary] = useState<RegionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(() => {
    const start = getParam("startDate");
    const end = getParam("endDate");
    if (start && end) return { start, end };
    return null;
  });
  const [dateRange, setDateRange] = useState<DateRangeType>(() => {
    const period = getParam("period");
    if (period === "custom") {
      const start = getParam("startDate");
      const end = getParam("endDate");
      return start && end ? "custom" : "today";
    }
    if (period === "today" || period === "week" || period === "month" || period === "all") {
      return period;
    }
    return "today";
  });

  const isSuperadmin = role === "superadmin";
  const isAdmin = role === "admin";
  const isLogist = role === "operator";
  const isCourier = role === "courier";
  const canViewStats = isAdmin || isSuperadmin || isLogist;

  const isChildRoute =
    pathname.includes("/regions/districts") ||
    pathname.includes("/regions/sato-management") ||
    pathname.includes("/regions/logist-assignment");

  useEffect(() => {
    let active = true;

    const fetchRegions = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = {};
        const now = dayjs();

        if (dateRange === "today") {
          params.startDate = now.startOf("day").format("YYYY-MM-DD");
          params.endDate = now.endOf("day").format("YYYY-MM-DD");
        } else if (dateRange === "week") {
          params.startDate = now.startOf("week").format("YYYY-MM-DD");
          params.endDate = now.endOf("week").format("YYYY-MM-DD");
        } else if (dateRange === "month") {
          params.startDate = now.startOf("month").format("YYYY-MM-DD");
          params.endDate = now.endOf("month").format("YYYY-MM-DD");
        } else if (dateRange === "custom" && customRange) {
          params.startDate = customRange.start;
          params.endDate = customRange.end;
        }

        const response = await api.get(API_ENDPOINTS.REGIONS.STATS_ALL, { params });
        if (!active) return;
        setRegions(unwrapRegions(response.data));
        setSummary(normalizeSummary(response.data));
      } catch {
        if (!active) return;
        setRegions([]);
        setSummary(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchRegions();
    return () => {
      active = false;
    };
  }, [dateRange, customRange]);

  const detailDateParams = useMemo<{ startDate?: string; endDate?: string }>(() => {
    const now = dayjs();

    if (dateRange === "today") {
      return {
        startDate: now.startOf("day").format("YYYY-MM-DD"),
        endDate: now.endOf("day").format("YYYY-MM-DD"),
      };
    }

    if (dateRange === "week") {
      return {
        startDate: now.startOf("week").format("YYYY-MM-DD"),
        endDate: now.endOf("week").format("YYYY-MM-DD"),
      };
    }

    if (dateRange === "month") {
      return {
        startDate: now.startOf("month").format("YYYY-MM-DD"),
        endDate: now.endOf("month").format("YYYY-MM-DD"),
      };
    }

    if (dateRange === "custom" && customRange) {
      return {
        startDate: customRange.start,
        endDate: customRange.end,
      };
    }

    return {};
  }, [dateRange, customRange]);

  useEffect(() => {
    if (dateRange === "custom" && customRange?.start && customRange?.end) {
      setMultipleParams({
        period: "custom",
        startDate: customRange.start,
        endDate: customRange.end,
      });
      return;
    }

    setMultipleParams({ period: dateRange });
    removeParam("startDate");
    removeParam("endDate");
  }, [dateRange, customRange, setMultipleParams, removeParam]);

  if (isChildRoute) {
    return <Outlet />;
  }

  if (!canViewStats && !isCourier) {
    return <Navigate to="/403" replace />;
  }

  return (
    <PageContainer>
        <div className="mb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-main dark:text-primary flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-main flex items-center justify-center shadow-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                </span>
                {t("title")}
              </h1>
              <p className="text-sm text-main/65 dark:text-primary/65 mt-1">
                {t("subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canViewStats && (
                <div className="flex items-center gap-1 rounded-xl border border-primarydark/20 bg-primary p-1 shadow-sm dark:border-white/10 dark:bg-primarydark/55">
                  <Calendar className="ml-2 h-4 w-4 text-main/55 dark:text-primary/70" />
                  {[
                    { value: "today" as const, label: t("dateRange.today") },
                    { value: "week" as const, label: t("dateRange.week") },
                    { value: "month" as const, label: t("dateRange.month") },
                    { value: "all" as const, label: t("dateRange.all") },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setDateRange(option.value);
                        setCustomRange(null);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                        dateRange === option.value
                          ? "bg-main text-primary"
                          : "text-maindark/70 hover:bg-sidebar dark:text-primary/75 dark:hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="mx-1 h-6 w-px bg-primarydark/30 dark:bg-white/15" />
                  <DateRangePicker
                    value={
                      dateRange === "custom" && customRange
                        ? {
                            startDate: parseISODate(customRange.start),
                            endDate: parseISODate(customRange.end),
                          }
                        : { startDate: null, endDate: null }
                    }
                    onChange={({ startDate, endDate }) => {
                      if (startDate && endDate) {
                        setDateRange("custom");
                        setCustomRange({
                          start: toISODate(startDate),
                          end: toISODate(endDate),
                        });
                        return;
                      }

                      setCustomRange(null);
                      setDateRange("all");
                    }}
                    className="w-[220px]"
                    size="sm"
                    placeholder={t("common:dateRangePlaceholder", {
                      from: t("common:from"),
                      to: t("common:to"),
                    })}
                  />
                </div>
              )}

              {(isAdmin || isSuperadmin) && (
                <div className="flex flex-wrap gap-2">
                  {(isAdmin || isSuperadmin) && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate("sato-management")}
                        className="flex items-center gap-2 rounded-xl border border-primarydark/10 bg-sidebar px-4 py-2 text-sm font-semibold text-main transition-colors hover:bg-main/10 dark:border-white/10 dark:bg-primarydark/45 dark:text-primary dark:hover:bg-white/10"
                      >
                        <Settings size={16} />
                        {t("actions.satoManagement")}
                      </button>
                    </>
                  )}
                  {isSuperadmin && (
                    <button
                      type="button"
                      onClick={() => navigate("districts")}
                      className="flex items-center gap-2 rounded-xl border border-primarydark/10 bg-sidebar px-4 py-2 text-sm font-semibold text-main transition-colors hover:bg-main/10 dark:border-white/10 dark:bg-primarydark/45 dark:text-primary dark:hover:bg-white/10"
                    >
                      <MapPin size={16} />
                      {t("actions.districts")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("logist-assignment")}
                    className="flex items-center gap-2 rounded-xl border border-primarydark/10 bg-sidebar px-4 py-2 text-sm font-semibold text-main transition-colors hover:bg-main/10 dark:border-white/10 dark:bg-primarydark/45 dark:text-primary dark:hover:bg-white/10"
                  >
                    <HeadphonesIcon size={16} />
                    {t("actions.logistAssignment")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isCourier ? (
          <div className="rounded-2xl border border-primarydark/20 bg-primary p-5 dark:border-white/10 dark:bg-primarydark/45">
            <p className="text-sm text-main/70 dark:text-primary/70 mb-2">{t("assignedRegion")}</p>
            <h3 className="text-2xl font-bold text-main dark:text-primary">{userRegionName || "—"}</h3>
          </div>
        ) : (
          <UzbekistanRegionMap
            regions={regions.map((region) => ({
              id: region.id,
              name: region.name,
              stats: {
                districtCount: region.districtCount,
                activeCouriers: region.activeCouriers,
                orderCount: region.ordersCount,
                deliveredOrders: region.deliveredOrders,
                cancelledOrders: region.cancelledOrders,
                pendingOrders: region.pendingOrders,
                totalRevenue: region.totalRevenue,
                successRate: region.successRate,
              },
            }))}
            summary={summary}
            startDate={detailDateParams.startDate}
            endDate={detailDateParams.endDate}
          />
        )}

        {isLoading ? (
          <div className="mt-4 text-sm text-main/60 dark:text-primary/60">{t("common:loading")}</div>
        ) : null}
    </PageContainer>
  );
};

export default memo(RegionPage);
