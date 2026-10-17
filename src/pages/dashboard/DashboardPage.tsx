import { lazy, memo, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { LayoutDashboard, Package, TrendingUp, Wallet, XCircle, BarChart2, MapPin, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import TopPerformers from "../../widgets/dashboard-top-performers/ui/TopPerformers";
import { RankingCard } from "../../widgets/dashboard-top-performers/ui/RankingCard";
import { DashboardPartError } from "../../widgets/dashboard-part-error/ui/DashboardPartError";
import RegionStatsCard from "../../widgets/dashboard-region/ui/RegionStatsCard";
import DeferredMount from "../../shared/ui/DeferredMount";
import { useDashboard } from "../../entities/dashboard";
import { hasFailedPart } from "../../entities/dashboard/lib/partialFailure";
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

/**
 * GRAFIKLI WIDGETLAR LAZY (NIFAnCvf). Recharts faqat shu widgetlar ekranga
 * yaqinlashganda yuklanadi — dashboard birinchi ochilishida emas.
 */
const DashboardStatistics = lazy(() => import("../../widgets/dashboard-statistics/ui/DashboardStatistics"));
const FinancialAnalysis = lazy(() => import("../../widgets/financial-analysis/ui/FinancialAnalysis"));
const PerformanceChart = lazy(() => import("../../widgets/dashboard-performance-chart/ui/PerformanceChart"));

const WidgetPlaceholder = ({ height }: { height: number }) => (
  <div
    aria-hidden
    className="animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)] dark:border-white/10"
    style={{ height }}
  />
);

const Deferred = ({ height, children }: { height: number; children: ReactNode }) => (
  <DeferredMount minHeight={height}>
    <Suspense fallback={<WidgetPlaceholder height={height} />}>{children}</Suspense>
  </DeferredMount>
);
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
  const isCourier = normalizedRole === "courier";
  // Operator uchun backend hali rolga xos scoping qilmaydi (analytics-service
  // uni ADMIN tarmog'iga tushiradi) — shu sabab kompaniya bo'ylab reyting va
  // hudud xaritasi kabi keng ko'lamli bloklar operatorga ko'rsatilmaydi,
  // faqat asosiy stat kartalar qoladi. To'liq scoping backend tuzatilgach
  // qo'shiladi (bog'liq: "Backend: /analytics/dashboard har qanday rolga...").
  const isOperator = normalizedRole === "operator";
  // Moliyaviy qator (daromad, foyda) + KPI kartalari faqat admin uchun:
  // KPI so'rovi boshqa rollarga yuborilmaydi (403), ya'ni ularda kartalar
  // soxta 0 ko'rsatardi, operatorga esa butun kompaniya daromadi chiqardi.
  const canShowFinancialMetrics = isAnalyticsAdmin;
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
    isFetching: dashboardFetching,
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
  // Backend "All" davrida to'liq statistikani bo'sh qaytaradi — shunda
  // grafik top-reytingga qaytadi; admin uchun topCouriers umuman kelmaydi.
  const marketStats = data?.data?.markets ?? [];
  const courierStats = data?.data?.couriers ?? [];
  const chartMarkets = marketStats.length ? marketStats : topMarkets;
  const chartCouriers = courierStats.length ? courierStats : topCouriers;
  // Qisman nosozlik (VkwhHqvW): olinmagan bo'lak 0 lar bilan emas, joyida xato holati bilan chiziladi.
  const failedParts = data?.data?.failedParts;
  // KPI: faqat statistikada chiziladigan ko'rsatkichlar olinmasa (`fulfillment` — yetkazish vaqti / SLA) yoki
  // qaysi bo'lak ekani aytilmasa; boshqa bo'lak (masalan `marketRating`) buyurtmalar statistikasini yashirmaydi.
  const kpiParts = kpiData?.data?.failedParts ?? [];
  const kpiStatsFailed =
    Boolean(kpiData?.data?.degraded) &&
    (kpiParts.length === 0 ||
      hasFailedPart(kpiParts, "fulfillment", "averageOrderValue", "averageFulfillmentHours", "onTimeRate"));
  const statsFailed =
    dashboardError || hasFailedPart(failedParts, "orders") || (!isAllTime && (kpiError || kpiStatsFailed));
  const marketsChartFailed = hasFailedPart(failedParts, "markets");
  const couriersChartFailed = hasFailedPart(failedParts, "couriers");
  const retryDashboard = () => void refetchDashboard();

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

      {isCourier && !dashboardError && hasFailedPart(failedParts, "topCouriers") ? (
        <DashboardPartError
          data-testid="courier-ranking-failed"
          className="mb-5"
          title={t("top.couriers_title")}
          onRetry={retryDashboard}
          retrying={dashboardFetching}
        />
      ) : null}

      {isCourier && !dashboardError && !hasFailedPart(failedParts, "topCouriers") && topCouriers.length > 0 && (
        <div className="mb-5">
          <TopPerformers couriers={topCouriers} currentUserId={user?.id ?? roleId} />
        </div>
      )}

      {/* Stat cards */}
      {!isCourier && widgets.stats && statsFailed && (
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

      {!isCourier && widgets.stats && !statsFailed && (
        <div className="mb-5">
          <Deferred height={360}>
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
          </Deferred>
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

      {/* Reytinglar — dizayn v2 (9zbSDkUI, `superadmin-dashboard-main`): qisqa davrda oxirgi 30 kun,
          izohda davr, bo'sh karta ixcham; telefonda ustma-ust. */}
      {widgets.topPerformers && canShowTopPerformers && !dashboardError && (
        <div data-testid="dashboard-rankings" className="mb-5 flex flex-wrap gap-4 [&>*]:flex-[1_1_300px]">
          {hasFailedPart(failedParts, "topMarkets") ? (
            <DashboardPartError
              data-testid="ranking-markets"
              title={t("top.markets_title")}
              onRetry={retryDashboard}
              retrying={dashboardFetching}
            />
          ) : (
            <RankingCard
              data-testid="ranking-markets"
              title={t("top.markets_title")}
              markets={topMarkets}
              meta={data?.data?.topMarketsMeta}
              loading={isLoading}
            />
          )}
          {hasFailedPart(failedParts, "topBranches") ? (
            <DashboardPartError
              data-testid="ranking-branches"
              title={t("top.branches_title")}
              onRetry={retryDashboard}
              retrying={dashboardFetching}
            />
          ) : (
            <RankingCard
              data-testid="ranking-branches"
              title={t("top.branches_title")}
              branches={topBranches}
              meta={data?.data?.topBranchesMeta}
              loading={isLoading}
            />
          )}
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
          {marketsChartFailed || couriersChartFailed ? (
            // Faqat olinmagan bo'lak xato kartasi bilan; sog' bo'lagi (marketlar yoki kuryerlar) grafikda qoladi.
            <div className="flex flex-col gap-4">
              {marketsChartFailed ? (
                <DashboardPartError
                  data-testid="performance-markets-failed"
                  title={t("performance.markets_title")}
                  onRetry={retryDashboard}
                  retrying={dashboardFetching}
                />
              ) : null}
              {couriersChartFailed ? (
                <DashboardPartError
                  data-testid="performance-couriers-failed"
                  title={t("performance.couriers_title")}
                  onRetry={retryDashboard}
                  retrying={dashboardFetching}
                />
              ) : null}
              {marketsChartFailed && couriersChartFailed ? null : (
                <PerformanceChart
                  markets={marketsChartFailed ? undefined : chartMarkets}
                  couriers={couriersChartFailed ? undefined : chartCouriers}
                  loading={isLoading}
                  couriersEmptyText={isAllTime ? t("performance.couriers_all_time_unavailable") : undefined}
                />
              )}
            </div>
          ) : (
            <Deferred height={420}>
            <PerformanceChart
              markets={chartMarkets}
              couriers={chartCouriers}
              loading={isLoading}
              // "Barchasi" davrida backend kuryerlar kesimini hisoblamaydi
              // (couriers: [], admin uchun topCouriers ham yo'q) — ma'lumot
              // bor, lekin bu davr uchun kelmaydi.
              couriersEmptyText={isAllTime ? t("performance.couriers_all_time_unavailable") : undefined}
            />
            </Deferred>
          )}
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
          <Deferred height={822}>
          <FinancialAnalysis
            startDate={hasDateFilter ? fromDate : ""}
            endDate={hasDateFilter ? toDate : ""}
            analyticsScope={analyticsScope}
            isAllTime={isAllTime}
          />
          </Deferred>
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
