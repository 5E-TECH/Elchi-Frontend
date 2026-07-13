import { memo, useCallback, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import TopPerformers from "../../widgets/dashboard-top-performers/ui/TopPerformers";
import RegionStatsCard from "../../widgets/dashboard-region/ui/RegionStatsCard";
import { useDashboard } from "../../entities/dashboard";
import { useSettings, DEFAULT_SETTINGS } from "../../entities/settings";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import QuickDateRangeFilter from "../../shared/ui/QuickDateRangeFilter";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import type { RootState } from "../../app/config/store";
import { removeFilterValue, setMultipleFilters } from "../../features/Select/model/FilterSlice";

// ─── DashboardPage ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { t } = useTranslation("dashboard");
  const dispatch = useDispatch();
  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const user = useSelector((state: RootState) => state.user.user);
  const role = useSelector((state: RootState) => state.role.role);
  const analyticsScope = `${role || "unknown"}:${user?.id || "unknown"}`;
  const normalizedRole = String(role || "").toLowerCase();
  // KPI and revenue analytics are backend-restricted to SUPERADMIN/ADMIN.
  // Firing them for other roles returns 403 and breaks the shared dashboard
  // landing page on every login — gate them client-side too. (Audit P1-2.)
  const isAnalyticsAdmin = ["superadmin", "admin"].includes(normalizedRole);
  const isRegistrator = normalizedRole === "registrator";
  const isCourier = normalizedRole === "courier";
  const canShowFinancialMetrics = !isRegistrator && !isCourier;
  const canShowTopPerformers = !isCourier;
  const canShowRegionStats = !isCourier;
  const [fromDate, setFromDate] = useState(
    typeof storedFromDate === "string" ? storedFromDate : "",
  );
  const [toDate, setToDate] = useState(
    typeof storedToDate === "string" ? storedToDate : "",
  );
  const { data: settingsData } = useSettings();
  const widgets = (settingsData ?? DEFAULT_SETTINGS).dashboard.widgets;

  const hasDateFilter = Boolean(fromDate && toDate);
  const allTimeRange = getAllTimeRange();
  const isAllTime = fromDate === allTimeRange.from && toDate === allTimeRange.to;

  const applyRange = useCallback(
    (range: { from: string; to: string }) => {
      setFromDate(range.from);
      setToDate(range.to);
      dispatch(
        setMultipleFilters({
          dashboardFromDate: range.from,
          dashboardToDate: range.to,
        }),
      );
    },
    [dispatch],
  );

  const { getDashboard, getKpi } = useDashboard();
  const analyticsParams = useMemo(
    () =>
      isAllTime
        ? { all: true }
        : {
            start_day: hasDateFilter ? fromDate : "",
            end_day: hasDateFilter ? toDate : "",
          },
    [fromDate, hasDateFilter, isAllTime, toDate],
  );
  const needsDashboard = widgets.stats || widgets.topPerformers;
  const {
    data,
    isLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = getDashboard(analyticsParams, needsDashboard, analyticsScope);
  const {
    data: kpiData,
    isLoading: kpiLoading,
    isError: kpiError,
    refetch: refetchKpi,
  } = getKpi(
    analyticsParams,
    widgets.stats && isAnalyticsAdmin && !isAllTime,
    analyticsScope,
  );

  const orders = data?.data?.orders;
  const kpi = kpiData?.data;
  const topMarkets = data?.data?.topMarkets ?? [];
  const topBranches = data?.data?.topBranches ?? [];

  const clearRange = useCallback(() => {
    setFromDate("");
    setToDate("");
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
  }, [dispatch]);

  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <HeaderName
          name={isAllTime ? t("page_title_all") : hasDateFilter ? t("page_title_filtered") : t("page_title_today")}
          description={isAllTime ? t("page_subtitle_all") : hasDateFilter ? t("page_subtitle_filtered") : t("page_subtitle_today")}
          icon={<LayoutDashboard />}
        />
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          <QuickDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={applyRange}
            onClear={clearRange}
            includeAll
            labels={{
              today: t("quickRanges.today"),
              week: t("quickRanges.week"),
              month: t("quickRanges.month"),
              year: t("quickRanges.year"),
              all: t("quickRanges.all"),
            }}
            placeholder={`${t("datePicker.from")} → ${t("datePicker.to")}`}
            className="lg:items-end"
            pickerClassName="w-full sm:w-88"
            clearClassName="sm:w-auto"
          />
        </div>
      </div>

      {/* Stat cards */}
      {widgets.stats && (dashboardError || (!isAllTime && kpiError)) && (
        <div className="mb-5">
          <QueryErrorState
            description={t("load_error")}
            onRetry={() =>
              void (isAllTime
                ? refetchDashboard()
                : Promise.all([refetchDashboard(), refetchKpi()]))
            }
          />
        </div>
      )}

      {widgets.stats && !dashboardError && (isAllTime || !kpiError) && (
        <div className="mb-5">
          <DashboardStatistics
            accepted={orders?.acceptedCount ?? 0}
            sold={orders?.soldAndPaid ?? 0}
            cancelled={orders?.cancelled ?? 0}
            profit={orders?.profit ?? 0}
            totalRevenue={orders?.totalRevenue ?? 0}
            avgOrderValue={kpi?.averageOrderValue ?? 0}
            avgFulfillmentHours={kpi?.averageFulfillmentHours ?? 0}
            onTimeRate={kpi?.onTimeRate ?? 0}
            showFinancialMetrics={canShowFinancialMetrics}
            loading={isLoading || (!isAllTime && kpiLoading)}
          />
        </div>
      )}

      {/* Top performers — marketlar & kuryerlar reytingi */}
      {widgets.topPerformers && dashboardError && !widgets.stats && (
        <div className="mb-5">
          <QueryErrorState
            description={t("load_error")}
            onRetry={() => void refetchDashboard()}
          />
        </div>
      )}

      {widgets.topPerformers && canShowTopPerformers && !dashboardError && (
        <div className="mb-5">
          <TopPerformers markets={topMarkets} branches={topBranches} />
        </div>
      )}

      {/* Financial analysis — revenue endpoint is SUPERADMIN/ADMIN-only. */}
      {widgets.financial && isAnalyticsAdmin && !isAllTime && (
        <div className="mb-5">
          <FinancialAnalysis
            startDate={hasDateFilter ? fromDate : ""}
            endDate={hasDateFilter ? toDate : ""}
            analyticsScope={analyticsScope}
            isAllTime={isAllTime}
          />
        </div>
      )}

      {/* Hududlar bo'yicha xarita */}
      {widgets.region && canShowRegionStats && (
        <RegionStatsCard
          startDate={hasDateFilter ? fromDate : ""}
          endDate={hasDateFilter ? toDate : ""}
          showFinancialMetrics={canShowFinancialMetrics}
        />
      )}
    </PageContainer>
  );
};

export default memo(DashboardPage);
