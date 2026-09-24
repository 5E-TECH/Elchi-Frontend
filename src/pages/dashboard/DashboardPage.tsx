import { memo, useCallback, useMemo, useState } from "react";
import { LayoutDashboard, Package, TrendingUp, Wallet, XCircle, BarChart2, MapPin, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import DashboardStatistics from "../../widgets/dashboard-statistics/ui/DashboardStatistics";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import TopPerformers from "../../widgets/dashboard-top-performers/ui/TopPerformers";
import RegionStatsCard from "../../widgets/dashboard-region/ui/RegionStatsCard";
import PerformanceChart from "../../widgets/dashboard-performance-chart/ui/PerformanceChart";
import { useDashboard } from "../../entities/dashboard";
import { useSettings, DEFAULT_SETTINGS } from "../../entities/settings";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import QuickDateRangeFilter from "../../shared/ui/QuickDateRangeFilter";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import MetricCard, { MetricCardSkeleton } from "../../shared/ui/MetricCard";
import MobileCollapsibleSection from "../../shared/ui/MobileCollapsibleSection";
import { formatNumber } from "../../shared/config/designSystem";
import type { RootState } from "../../app/config/store";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";

// ─── DashboardPage ────────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { t } = useTranslation("dashboard");
  const dispatch = useDispatch();
  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const user = useSelector((state: RootState) => state.user.user);
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  const analyticsScope = `${role || "unknown"}:${user?.id || "unknown"}`;
  const normalizedRole = String(role || "").toLowerCase();
  // KPI and revenue analytics are backend-restricted to SUPERADMIN/ADMIN.
  // Firing them for other roles returns 403 and breaks the shared dashboard
  // landing page on every login — gate them client-side too. (Audit P1-2.)
  const isAnalyticsAdmin = ["superadmin", "admin"].includes(normalizedRole);
  const isRegistrator = normalizedRole === "registrator";
  const isCourier = normalizedRole === "courier";
  // Operator uchun backend hali rolga xos scoping qilmaydi (analytics-service
  // uni ADMIN tarmog'iga tushiradi) — shu sabab kompaniya bo'ylab reyting va
  // hudud xaritasi kabi keng ko'lamli bloklar operatorga ko'rsatilmaydi,
  // faqat asosiy stat kartalar qoladi. To'liq scoping backend tuzatilgach
  // qo'shiladi (bog'liq: "Backend: /analytics/dashboard har qanday rolga...").
  const isOperator = normalizedRole === "operator";
  const canShowFinancialMetrics = !isRegistrator && !isCourier;
  const canShowTopPerformers = !isCourier && !isOperator;
  const canShowRegionStats = !isCourier && !isOperator;
  // Market roli bu sahifaga umuman kelmaydi (routes.tsx market uchun
  // MarketDashboardPage'ni render qiladi, u yerda alohida — faqat
  // marketlar bo'limi bilan — ulanган). Shu sabab bu yerda faqat
  // kuryer/operator uchun yashirish yetarli.
  const canShowPerformanceChart = !isCourier && !isOperator;
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
  const needsDashboard = isCourier || widgets.stats || widgets.topPerformers || widgets.performanceChart;
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
  const courierStat = data?.data?.myStat;
  const kpi = kpiData?.data;
  const topMarkets = data?.data?.topMarkets ?? [];
  const topBranches = data?.data?.topBranches ?? [];
  const topCouriers = data?.data?.topCouriers ?? [];

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

      {isCourier && (
        <div className="mb-5">
          {dashboardError || (!isLoading && !courierStat) ? (
            <QueryErrorState
              description={t(dashboardError ? "load_error" : "courier_stats_unavailable")}
              onRetry={() => void refetchDashboard()}
            />
          ) : (
            <div data-testid="courier-stats-grid" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {isLoading || !courierStat ? (
                Array.from({ length: 4 }).map((_, index) => <MetricCardSkeleton key={index} />)
              ) : (
                <>
                  <MetricCard
                    title={t("cards.total_orders")}
                    value={formatNumber(courierStat.totalOrders)}
                    icon={<Package size={20} />}
                    tone="brand"
                  />
                  <MetricCard
                    title={t("cards.sold")}
                    value={formatNumber(courierStat.soldOrders)}
                    icon={<TrendingUp size={20} />}
                    tone="success"
                    badge={`${courierStat.successRate}%`}
                  />
                  <MetricCard
                    title={t("cards.cancelled")}
                    value={formatNumber(courierStat.canceledOrders)}
                    icon={<XCircle size={20} />}
                    tone="danger"
                  />
                  <MetricCard
                    title={t("cards.courier_profit")}
                    value={new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 20 }).format(courierStat.profit)}
                    suffix={t("currency_sum")}
                    icon={<Wallet size={20} />}
                    tone={courierStat.profit < 0 ? "danger" : "success"}
                    compact
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isCourier && !dashboardError && topCouriers.length > 0 && (
        <div className="mb-5">
          <TopPerformers couriers={topCouriers} currentUserId={user?.id ?? roleId} />
        </div>
      )}

      {/* Stat cards */}
      {!isCourier && widgets.stats && (dashboardError || (!isAllTime && kpiError)) && (
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

      {!isCourier && widgets.stats && !dashboardError && (isAllTime || !kpiError) && (
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
      {!isCourier && widgets.topPerformers && dashboardError && !widgets.stats && (
        <div className="mb-5">
          <QueryErrorState
            description={t("load_error")}
            onRetry={() => void refetchDashboard()}
          />
        </div>
      )}

      {widgets.topPerformers && canShowTopPerformers && !dashboardError && (
        <div className="mb-5">
          <TopPerformers markets={topMarkets} branches={topBranches} currentUserId={user?.id ?? roleId} />
        </div>
      )}

      {/* Marketlar/kuryerlar solishtiruv diagrammasi — top 5 bilan
          cheklanmagan, barcha marketlar/kuryerlarni ko'rsatadi. */}
      {widgets.performanceChart && canShowPerformanceChart && !dashboardError && (
        <MobileCollapsibleSection
          title={t("performance.title")}
          icon={<BarChart3 size={16} />}
          className="mb-5"
        >
          <PerformanceChart markets={topMarkets} couriers={topCouriers} />
        </MobileCollapsibleSection>
      )}

      {/* Financial analysis — revenue endpoint is SUPERADMIN/ADMIN-only.
          Og'ir blok (822px) — telefonda yopiq akkordeon, desktop/planshetda ochiq. */}
      {widgets.financial && isAnalyticsAdmin && !isAllTime && (
        <MobileCollapsibleSection
          title={t("financial_analysis.title")}
          icon={<BarChart2 size={16} />}
          className="mb-5"
        >
          <FinancialAnalysis
            startDate={hasDateFilter ? fromDate : ""}
            endDate={hasDateFilter ? toDate : ""}
            analyticsScope={analyticsScope}
            isAllTime={isAllTime}
          />
        </MobileCollapsibleSection>
      )}

      {/* Hududlar bo'yicha xarita — og'ir blok (~830px), telefonda yopiq akkordeon. */}
      {widgets.region && canShowRegionStats && (
        <MobileCollapsibleSection title={t("region.title")} icon={<MapPin size={16} />}>
          <RegionStatsCard
            startDate={hasDateFilter ? fromDate : ""}
            endDate={hasDateFilter ? toDate : ""}
            showFinancialMetrics={canShowFinancialMetrics}
          />
        </MobileCollapsibleSection>
      )}
    </PageContainer>
  );
};

export default memo(DashboardPage);
