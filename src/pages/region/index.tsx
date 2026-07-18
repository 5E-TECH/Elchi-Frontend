import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Calendar, HeadphonesIcon, MapPin, Settings } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../app/config/store";
import {
  mergeRegionDistrictStats,
  useRegionDetailStats,
  useRegionDistrictCatalog,
  useRegionStats,
} from "../../entities/region";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { parseISODate, toISODate } from "../../shared/lib/dateRange";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import DateRangePicker from "../../shared/ui/DateRangePicker";
import PageContainer from "../../shared/ui/PageContainer";
import ScopedRegionStatistics from "./ui/ScopedRegionStatistics";
import UzbekistanRegionMap from "./ui/UzbekistanRegionMap";
import {
  findOrderRegionScope,
  resolveRegionScope,
} from "./model/regionScope";

type DateRangeType = "today" | "week" | "month" | "all" | "custom";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getNestedRecord = (source: Record<string, unknown>, key: string) => asRecord(source[key]);

const getProfileBranchId = (profile: unknown): string => {
  const user = asRecord(profile);
  const branch = getNestedRecord(user, "branch");
  const nestedBranch = getNestedRecord(branch, "branch");
  const id = user.branch_id ?? branch.id ?? nestedBranch.id;

  return id == null ? "" : String(id);
};

const RegionPage = () => {
  const { t } = useTranslation("region");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { getParam, setMultipleParams, removeParam } = useQueryParams();
  const role = useSelector((state: RootState) => state.role.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const userRegionName = useSelector((state: RootState) => state.role.region);

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
  const isManager = role === "manager";
  const isCourier = role === "courier";
  const canViewStats = isAdmin || isSuperadmin;
  const canViewScopedStats = isManager || isCourier;
  const canUseDateFilter = canViewStats || canViewScopedStats;

  const isChildRoute =
    pathname.includes("/regions/districts") ||
    pathname.includes("/regions/sato-management") ||
    pathname.includes("/regions/logist-assignment");

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

  const regionStatsQuery = useRegionStats(
    detailDateParams,
    canViewStats || canViewScopedStats,
  );
  const regions = regionStatsQuery.data?.regions ?? [];
  const summary = regionStatsQuery.data?.summary ?? null;
  const endpointScopedDetail = regionStatsQuery.data?.scopedDetail ?? null;
  const profileRegionScope = resolveRegionScope(profile);
  const courierRegionQuery = useQuery({
    queryKey: ["courier-region-scope", profile?.id],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.ORDERS.BASE, {
        params: { page: 1, limit: 10 },
      });
      return findOrderRegionScope(response.data);
    },
    enabled:
      isCourier &&
      Boolean(profile?.id) &&
      !profileRegionScope.id &&
      !profileRegionScope.name,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const effectiveRegionScope =
    profileRegionScope.id || profileRegionScope.name
      ? profileRegionScope
      : courierRegionQuery.data ?? profileRegionScope;
  const profileRegionId = effectiveRegionScope.id;
  const scopedRegion = useMemo(() => {
    if (profileRegionId) {
      return regions.find((region) => region.id === profileRegionId) ?? null;
    }

    const normalizedProfileRegionName = (
      effectiveRegionScope.name ||
      String(userRegionName ?? "")
    ).trim().toLowerCase();
    if (normalizedProfileRegionName) {
      const matchedRegion = regions.find(
        (region) => region.name.trim().toLowerCase() === normalizedProfileRegionName,
      );
      if (matchedRegion) return matchedRegion;
    }

    return regions.length === 1 ? regions[0] : null;
  }, [effectiveRegionScope.name, profileRegionId, regions, userRegionName]);
  const scopedRegionId =
    profileRegionId ||
    scopedRegion?.id ||
    endpointScopedDetail?.id ||
    "";
  const scopedBranchId = getProfileBranchId(profile);
  const scopedStatsParams = useMemo(
    () => ({
      ...detailDateParams,
      ...(isCourier && profile?.id ? { courier_id: String(profile.id) } : {}),
      ...(isManager && scopedBranchId ? { branch_id: scopedBranchId } : {}),
    }),
    [detailDateParams, isCourier, isManager, profile?.id, scopedBranchId],
  );
  const scopedStatsQuery = useRegionDetailStats(
    scopedRegionId,
    scopedStatsParams,
    canViewScopedStats && !isCourier && Boolean(scopedRegionId),
  );
  const districtCatalogQuery = useRegionDistrictCatalog(
    scopedRegionId,
    canViewScopedStats && Boolean(scopedRegionId),
  );
  const scopedStats = useMemo(
    () => {
      const courierFallback = isCourier && scopedRegion
        ? {
            id: scopedRegion.id,
            name: scopedRegion.name,
            summary: {
              totalOrders: scopedRegion.ordersCount,
              totalDelivered: scopedRegion.deliveredOrders,
              totalCancelled: scopedRegion.cancelledOrders,
              totalRevenue: scopedRegion.totalRevenue,
              pendingOrders: scopedRegion.pendingOrders,
              activeCouriers: scopedRegion.activeCouriers,
              successRate: scopedRegion.successRate,
            },
            districts: [],
          }
        : null;

      return mergeRegionDistrictStats(
        scopedStatsQuery.data ?? endpointScopedDetail ?? courierFallback,
        districtCatalogQuery.data ?? [],
        {
          id: scopedRegionId,
          name:
            scopedRegion?.name ||
            effectiveRegionScope.name ||
            String(userRegionName ?? ""),
        },
      );
    },
    [
      districtCatalogQuery.data,
      effectiveRegionScope.name,
      endpointScopedDetail,
      isCourier,
      scopedRegion,
      scopedRegionId,
      scopedStatsQuery.data,
      userRegionName,
    ],
  );

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

  if (!canViewStats && !canViewScopedStats) {
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
                {canViewScopedStats && (scopedStats?.name || scopedRegion?.name || userRegionName)
                  ? t("scopedTitle", {
                      region: scopedStats?.name || scopedRegion?.name || userRegionName,
                    })
                  : t("title")}
              </h1>
              <p className="text-sm text-main/65 dark:text-primary/65 mt-1">
                {canViewScopedStats ? t("scopedSubtitle") : t("subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canUseDateFilter && (
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
                      from: t("common:startDate"),
                      to: t("common:endDate"),
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

        {canViewScopedStats ? (
          regionStatsQuery.isLoading ||
          courierRegionQuery.isLoading ||
          (scopedRegionId && districtCatalogQuery.isLoading) ||
          (!isCourier && scopedRegionId && scopedStatsQuery.isLoading) ? (
            <div className="rounded-2xl border border-primarydark/20 bg-primary p-8 text-center text-sm text-main/60 dark:border-white/10 dark:bg-primarydark/45 dark:text-primary/60">
              {t("common:loading")}
            </div>
          ) : regionStatsQuery.isError ||
            (scopedStatsQuery.isError && districtCatalogQuery.isError) ? (
            <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-100">
              {t("map.loadingError")}
            </div>
          ) : !scopedRegionId && !endpointScopedDetail ? (
            <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-100">
              {t("map.regionNotFound")}
            </div>
          ) : scopedStats ? (
            <ScopedRegionStatistics data={scopedStats} />
          ) : null
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

        {regionStatsQuery.isLoading && !canViewScopedStats ? (
          <div className="mt-4 text-sm text-main/60 dark:text-primary/60">{t("common:loading")}</div>
        ) : null}
    </PageContainer>
  );
};

export default memo(RegionPage);
