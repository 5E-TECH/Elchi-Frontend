import { memo, useCallback, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Plus,
  ShoppingBag,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../../entities/dashboard";
import { hasFailedPart } from "../../entities/dashboard/lib/partialFailure";
import { useOrders } from "../../entities/orders";
import { useSettings, DEFAULT_SETTINGS } from "../../entities/settings";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import QuickDateRangeFilter from "../../shared/ui/QuickDateRangeFilter";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import MetricCard, { MetricCardSkeleton } from "../../shared/ui/MetricCard";
import TopPerformers from "../../widgets/dashboard-top-performers/ui/TopPerformers";
import { DashboardPartError } from "../../widgets/dashboard-part-error/ui/DashboardPartError";
import ExtraCostApprovalsCard from "./ui/ExtraCostApprovalsCard";
import PerformanceChart from "../../widgets/dashboard-performance-chart/ui/PerformanceChart";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import type { RootState } from "../../app/config/store";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";
import {
  formatNumber,
  ratio,
} from "../../shared/config/designSystem";
import { getActionErrorMessage } from "../../shared/lib/actionError";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { notify } from "../../shared/lib/notify";

// ─── MarketDashboardPage ──────────────────────────────────────────────────────

const MarketDashboardPage = () => {
  const { t } = useTranslation("dashboard");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ─── Redux holat ─────────────────────────────────────────────────────────────
  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const user = useSelector((state: RootState) => state.user.user);
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);

  // ─── Sana filtri holati ───────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(
    typeof storedFromDate === "string" ? storedFromDate : "",
  );
  const [toDate, setToDate] = useState(typeof storedToDate === "string" ? storedToDate : "");

  // Sozlamalardagi "Dashboard vidjetlari" market uchun ham ko'rsatiladi —
  // shu sabab bu yerda ham hurmat qilinadi.
  const { data: settingsData } = useSettings();
  const widgets = (settingsData ?? DEFAULT_SETTINGS).dashboard.widgets;

  const hasDateFilter = Boolean(fromDate && toDate);
  const allTimeRange = getAllTimeRange();
  const isAllTime = fromDate === allTimeRange.from && toDate === allTimeRange.to;

  // ─── Scope: re-render minimizatsiya uchun ─────────────────────────────────────
  const analyticsScope = useMemo(
    () => `${role ?? "unknown"}:${user?.id ?? "unknown"}`,
    [role, user?.id],
  );

  const analyticsParams = useMemo(
    () => ({
      start_day: hasDateFilter ? fromDate : "",
      end_day: hasDateFilter ? toDate : "",
    }),
    [fromDate, hasDateFilter, toDate],
  );

  // ─── API so'rovlari ───────────────────────────────────────────────────────────
  const { getDashboard } = useDashboard();
  const { useExtraCostApprovals, approveExtraCostApproval, rejectExtraCostApproval } = useOrders();

  const {
    data,
    isLoading,
    isFetching: dashboardFetching,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = getDashboard(analyticsParams, true, analyticsScope);

  const {
    data: approvalResponse,
    isLoading: approvalsLoading,
    isError: approvalsError,
    error: approvalsErrorObject,
    refetch: refetchApprovals,
  } = useExtraCostApprovals("pending", true);
  const extraCostApprovals = Array.isArray(approvalResponse?.data) ? approvalResponse.data : [];

  // fix3 FE-ORD-02: tasdiqlash/rad etish rad javobi endi ko'rinadi (avval
  // tugma jimgina "qaytib" qolardi va market nima bo'lganini bilmasdi).
  // 1tnpaIqd: qaror atomik — so'rovni boshqa joyda (Telegram, boshqa oyna) allaqachon hal qilingan bo'lsa backend
  // 400 «Bu so'rov allaqachon yakunlangan» qaytaradi: bu xato emas — xabar beriladi va ro'yxat yangilanadi.
  const notifyApprovalError = useCallback(
    (error: unknown) => {
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 400 && /allaqachon yakunlangan/i.test(getBackendErrorMessage(error) ?? "")) {
        notify.info(t("market.extra_cost_already_resolved"));
        void refetchApprovals();
        return;
      }
      const description = getActionErrorMessage(error, t("market.extra_cost_action_error"));
      if (!description) return;
      notify.error(t("common:error"), { description });
    },
    [refetchApprovals, t],
  );

  // ─── Hisoblangan qiymatlar ────────────────────────────────────────────────────
  const orders = data?.data?.orders;
  const myStat = data?.data?.myStat;

  const accepted = myStat?.totalOrders ?? orders?.acceptedCount ?? 0;
  const sold = myStat?.soldOrders ?? orders?.soldAndPaid ?? 0;
  const cancelled = myStat?.canceledOrders ?? orders?.cancelled ?? 0;
  const profit = myStat?.profit ?? orders?.profit ?? 0;
  const topMarkets = data?.data?.topMarkets ?? [];
  const topOperators = data?.data?.topOperators ?? [];
  // Grafik TO'LIQ statistikadan (`markets`) chiziladi (PMa5dgYQ): `topMarkets`
  // ≥30 buyurtma chegarali reyting — market o'z ma'lumoti bo'lsa ham bo'sh
  // grafik ko'rardi. "Barchasi" davrida `markets` bo'sh keladi — top-reyting.
  const marketStats = data?.data?.markets ?? [];
  const chartMarkets = marketStats.length ? marketStats : topMarkets;
  // Qisman nosozlik (VkwhHqvW): olinmagan bo'lak 0 lar bilan emas, joyida xato holati bilan chiziladi.
  const failedParts = data?.data?.failedParts;
  const statsFailed = hasFailedPart(failedParts, "orders", "myStat");
  const marketsRankingFailed = hasFailedPart(failedParts, "topMarkets");
  const operatorsFailed = hasFailedPart(failedParts, "topOperators");
  const chartFailed = hasFailedPart(failedParts, "markets");
  const retryDashboard = () => void refetchDashboard();

  const successRate = myStat?.successRate ?? ratio(sold, accepted);

  // ─── Market add_order ruxsati ─────────────────────────────────────────────────
  const canAddOrder = Boolean((user as Record<string, unknown> | null)?.add_order);

  // ─── Sana filtri callbacklari ─────────────────────────────────────────────────
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

  const clearRange = useCallback(() => {
    setFromDate("");
    setToDate("");
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
  }, [dispatch]);

  const isDataLoading = isLoading;

  return (
    <PageContainer>
      {/* Sahifa sarlavhasi */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <HeaderName
          name={
            isAllTime
              ? t("page_title_all")
              : hasDateFilter
                ? t("page_title_filtered")
                : t("market.page_title")
          }
          description={
            isAllTime
              ? t("page_subtitle_all")
              : hasDateFilter
                ? t("page_subtitle_filtered")
                : t("market.page_subtitle")
          }
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

      {/* Yangi buyurtma qo'shish tugmasi */}
      {canAddOrder && (
        <div className="mb-5">
          <button
            onClick={() => navigate("/new-orders/create")}
            className="flex items-center gap-2.5 rounded-2xl bg-main px-5 py-3 text-sm font-bold text-white shadow-lg shadow-main/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-main/90 hover:shadow-main/40 active:translate-y-0"
          >
            <Plus size={18} />
            {t("market.add_order")}
          </button>
        </div>
      )}

      {/* Xato holati */}
      {dashboardError && (
        <div className="mb-5">
          <QueryErrorState description={t("load_error")} onRetry={() => void refetchDashboard()} />
        </div>
      )}

      <ExtraCostApprovalsCard
        approvals={extraCostApprovals}
        loading={approvalsLoading}
        // Kesh bor-u fon yangilanishi yiqilsa — ro'yxat qoladi (QueryBoundary qoidasi), xato faqat ma'lumot yo'qda.
        error={approvalsError && !approvalResponse}
        errorObject={approvalsErrorObject}
        onRetry={() => void refetchApprovals()}
        approvingId={
          approveExtraCostApproval.isPending
            ? String(approveExtraCostApproval.variables?.id ?? "")
            : ""
        }
        rejectingId={
          rejectExtraCostApproval.isPending
            ? String(rejectExtraCostApproval.variables?.id ?? "")
            : ""
        }
        onApprove={(id) => approveExtraCostApproval.mutate({ id }, { onError: notifyApprovalError })}
        onReject={(id) => rejectExtraCostApproval.mutate({ id }, { onError: notifyApprovalError })}
      />

      {/* Marketga ruxsatli dashboard statistikasi */}
      {!dashboardError && statsFailed ? (
        <div className="mb-5">
          <QueryErrorState description={t("load_error")} onRetry={retryDashboard} />
        </div>
      ) : null}

      {!dashboardError && !statsFailed && (
        <div className="mb-5">
          <MarketStatsGrid
            accepted={accepted}
            sold={sold}
            cancelled={cancelled}
            profit={profit}
            successRate={successRate}
            loading={isDataLoading}
            t={t}
          />
        </div>
      )}

      {widgets.topPerformers && !dashboardError && !isDataLoading && marketsRankingFailed ? (
        <DashboardPartError
          data-testid="market-ranking-failed"
          className="mb-5"
          title={t("top.markets_title")}
          onRetry={retryDashboard}
          retrying={dashboardFetching}
        />
      ) : null}

      {/* Olinmagan bo'lak o'rnida xato kartasi; sog' bo'lagi (marketlar yoki operatorlar) reytingda qoladi. */}
      {widgets.topPerformers && !dashboardError && !isDataLoading && !(marketsRankingFailed && operatorsFailed) && (
        <div className="mb-5 empty:hidden">
          <TopPerformers
            markets={marketsRankingFailed ? undefined : topMarkets}
            operators={!operatorsFailed && topOperators.length ? topOperators : undefined}
            currentUserId={user?.id ?? roleId}
          />
        </div>
      )}

      {widgets.topPerformers && !dashboardError && !isDataLoading && operatorsFailed ? (
        <DashboardPartError
          data-testid="operators-ranking-failed"
          className="mb-5"
          title={t("top.operators_title")}
          onRetry={retryDashboard}
          retrying={dashboardFetching}
        />
      ) : null}

      {/* Marketlar solishtiruv diagrammasi — kuryerlar bo'limi yo'q, chunki
          market foydalanuvchisiga tegishli emas (DashboardPage'dagi bilan
          bir xil qoida). */}
      {widgets.performanceChart && !dashboardError && !isDataLoading && chartFailed ? (
        <DashboardPartError
          data-testid="performance-markets-failed"
          className="mb-5"
          // Market grafigida faqat marketlar bo'limi (kuryerlar yo'q) — sarlavha o'shaniki.
          title={t("performance.markets_title")}
          onRetry={retryDashboard}
          retrying={dashboardFetching}
        />
      ) : null}

      {widgets.performanceChart && !dashboardError && !isDataLoading && !chartFailed && (
        <div className="mb-5">
          <PerformanceChart markets={chartMarkets} />
        </div>
      )}

      {/* Tezkor harakatlar */}
      {!dashboardError && !isDataLoading && (
        <MarketQuickActions
          onViewOrders={() => navigate("/new-orders")}
          onAddOrder={canAddOrder ? () => navigate("/new-orders/create") : undefined}
          t={t}
        />
      )}
    </PageContainer>
  );
};

// ─── MarketStatsGrid ──────────────────────────────────────────────────────────

interface MarketStatsGridProps {
  accepted: number;
  sold: number;
  cancelled: number;
  profit: number;
  successRate: number;
  loading: boolean;
  t: (key: string) => string;
}

const MarketStatsGrid = memo(
  ({
    accepted,
    sold,
    cancelled,
    profit,
    successRate,
    loading,
    t,
  }: MarketStatsGridProps) => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    const profitTone = profit < 0 ? "danger" : ("success" as const);
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="market-stats-grid">
        <MetricCard
          title={t("cards.total_orders")}
          value={formatNumber(accepted)}
          suffix={t("unit.orders")}
          icon={<ShoppingBag size={20} />}
          tone="brand"
        />
        <MetricCard
          title={t("cards.sold")}
          value={formatNumber(sold)}
          suffix={t("unit.orders")}
          icon={<TrendingUp size={20} />}
          tone="success"
          badge={`${successRate}%`}
          badgeUp={successRate > 50}
        />
        <MetricCard
          title={t("cards.cancelled")}
          value={formatNumber(cancelled)}
          suffix={t("unit.orders")}
          icon={<XCircle size={20} />}
          tone="danger"
        />
        <MetricCard
          title={t("cards.profit")}
          value={new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 20 }).format(profit)}
          suffix={t("currency_sum")}
          icon={<TrendingUp size={20} />}
          tone={profitTone}
          compact
          hint={t("cards.profit_hint")}
        />
      </div>
    );
  },
);

MarketStatsGrid.displayName = "MarketStatsGrid";

// ─── MarketQuickActions ───────────────────────────────────────────────────────

interface MarketQuickActionsProps {
  onViewOrders: () => void;
  onAddOrder?: () => void;
  t: (key: string) => string;
}

const MarketQuickActions = memo(({ onViewOrders, onAddOrder, t }: MarketQuickActionsProps) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-primarydark sm:p-5">
    <h3 className="mb-3 text-sm font-bold text-maindark dark:text-primary">
      {t("market.quick_actions")}
    </h3>
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onViewOrders}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-maindark transition-all duration-150 hover:border-main/30 hover:bg-main/5 dark:border-white/10 dark:bg-white/5 dark:text-primary dark:hover:bg-main/10"
      >
        <ShoppingBag size={15} />
        {t("market.view_orders")}
      </button>

      {onAddOrder && (
        <button
          onClick={onAddOrder}
          className="flex items-center gap-2 rounded-xl bg-main px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-main/20 transition-all duration-150 hover:bg-main/90"
        >
          <Plus size={15} />
          {t("market.add_order")}
        </button>
      )}
    </div>
  </div>
));

MarketQuickActions.displayName = "MarketQuickActions";

export default memo(MarketDashboardPage);
