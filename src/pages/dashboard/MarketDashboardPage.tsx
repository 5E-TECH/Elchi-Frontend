import { memo, useCallback, useMemo, useState } from "react";
import { LayoutDashboard, Plus, ShoppingBag, XCircle, TrendingUp, Package, Timer, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../../entities/dashboard";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import QuickDateRangeFilter from "../../shared/ui/QuickDateRangeFilter";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import MetricCard, { MetricCardSkeleton } from "../../shared/ui/MetricCard";
import type { RootState } from "../../app/config/store";
import { removeFilterValue, setMultipleFilters } from "../../features/Select/model/FilterSlice";
import {
  formatCompactMoney,
  formatNumber,
  formatPercent,
  formatHours,
  ratio,
} from "../../shared/config/designSystem";

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

  // ─── Sana filtri holati ───────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(
    typeof storedFromDate === "string" ? storedFromDate : "",
  );
  const [toDate, setToDate] = useState(
    typeof storedToDate === "string" ? storedToDate : "",
  );

  const hasDateFilter = Boolean(fromDate && toDate);

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
  const { getDashboard, getKpi } = useDashboard();

  const {
    data,
    isLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = getDashboard(analyticsParams, true, analyticsScope);

  const {
    data: kpiData,
    isLoading: kpiLoading,
    isError: kpiError,
    refetch: refetchKpi,
  } = getKpi(analyticsParams, true, analyticsScope);

  // ─── Hisoblangan qiymatlar ────────────────────────────────────────────────────
  const orders = data?.data?.orders;
  const kpi = kpiData?.data;

  const accepted = orders?.acceptedCount ?? 0;
  const sold = orders?.soldAndPaid ?? 0;
  const cancelled = orders?.cancelled ?? 0;
  const profit = orders?.profit ?? 0;
  const avgOrderValue = kpi?.averageOrderValue ?? 0;
  const avgFulfillmentHours = kpi?.averageFulfillmentHours ?? 0;
  const onTimeRate = kpi?.onTimeRate ?? 0;

  const inProgress = Math.max(0, accepted - sold - cancelled);
  const successRate = ratio(sold, accepted);

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

  const isDataLoading = isLoading || kpiLoading;
  const hasError = dashboardError || kpiError;

  return (
    <PageContainer>
      {/* Sahifa sarlavhasi */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <HeaderName
          name={hasDateFilter ? t("page_title_filtered") : t("market.page_title")}
          description={hasDateFilter ? t("page_subtitle_filtered") : t("market.page_subtitle")}
          icon={<LayoutDashboard />}
        />

        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          <QuickDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={applyRange}
            onClear={clearRange}
            labels={{
              today: t("quickRanges.today"),
              week: t("quickRanges.week"),
              month: t("quickRanges.month"),
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
            onClick={() => navigate("/orders/add")}
            className="flex items-center gap-2.5 rounded-2xl bg-main px-5 py-3 text-sm font-bold text-white shadow-lg shadow-main/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-main/90 hover:shadow-main/40 active:translate-y-0"
          >
            <Plus size={18} />
            {t("market.add_order")}
          </button>
        </div>
      )}

      {/* Xato holati */}
      {hasError && (
        <div className="mb-5">
          <QueryErrorState
            description={t("load_error")}
            onRetry={() => void Promise.all([refetchDashboard(), refetchKpi()])}
          />
        </div>
      )}

      {/* KPI kartalar */}
      {!hasError && (
        <div className="mb-5">
          <MarketStatsGrid
            accepted={accepted}
            sold={sold}
            cancelled={cancelled}
            inProgress={inProgress}
            profit={profit}
            avgOrderValue={avgOrderValue}
            avgFulfillmentHours={avgFulfillmentHours}
            onTimeRate={onTimeRate}
            successRate={successRate}
            loading={isDataLoading}
            t={t}
          />
        </div>
      )}

      {/* Tezkor harakatlar */}
      {!hasError && !isDataLoading && (
        <MarketQuickActions
          onViewOrders={() => navigate("/new-orders")}
          onAddOrder={canAddOrder ? () => navigate("/orders/add") : undefined}
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
  inProgress: number;
  profit: number;
  avgOrderValue: number;
  avgFulfillmentHours: number;
  onTimeRate: number;
  successRate: number;
  loading: boolean;
  t: (key: string) => string;
}

const MarketStatsGrid = memo(({
  accepted,
  sold,
  cancelled,
  inProgress,
  profit,
  avgOrderValue,
  avgFulfillmentHours,
  onTimeRate,
  successRate,
  loading,
  t,
}: MarketStatsGridProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const profitTone = profit < 0 ? "danger" : "success" as const;
  const slaTone =
    onTimeRate >= 70 ? "success" : onTimeRate >= 40 ? "warning" : "danger" as const;

  return (
    <div className="space-y-4">
      {/* Asosiy statistika */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Jami qabul qilingan */}
        <div className="col-span-2 md:col-span-1">
          <MetricCard
            title={t("cards.accepted")}
            value={formatNumber(accepted)}
            suffix={t("unit.orders")}
            icon={<ShoppingBag size={20} />}
            tone="brand"
            hint={t("cards.accepted_hint")}
          />
        </div>

        {/* Sotilgan */}
        <MetricCard
          title={t("cards.sold")}
          value={formatNumber(sold)}
          suffix={t("unit.orders")}
          icon={<TrendingUp size={20} />}
          tone="success"
          badge={formatPercent(successRate)}
          badgeUp={successRate > 50}
        />

        {/* Bekor qilingan */}
        <MetricCard
          title={t("cards.cancelled")}
          value={formatNumber(cancelled)}
          suffix={t("unit.orders")}
          icon={<XCircle size={20} />}
          tone="danger"
        />

        {/* Jarayonda */}
        <MetricCard
          title={t("cards.in_progress")}
          value={formatNumber(inProgress)}
          suffix={t("unit.orders")}
          icon={<Package size={20} />}
          tone="warning"
          hint={t("cards.in_progress_hint")}
        />
      </div>

      {/* KPI ko'rsatkichlari */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t("cards.profit")}
          value={formatCompactMoney(profit)}
          suffix={t("currency_sum")}
          icon={<TrendingUp size={20} />}
          tone={profitTone}
          compact
          hint={t("cards.profit_hint")}
        />

        <MetricCard
          title={t("cards.avg_order_value")}
          value={formatCompactMoney(avgOrderValue)}
          suffix={t("currency_sum")}
          icon={<ShoppingBag size={20} />}
          tone="brand"
          compact
          hint={t("cards.avg_order_value_hint")}
        />

        <MetricCard
          title={t("cards.avg_fulfillment")}
          value={formatHours(avgFulfillmentHours)}
          icon={<Timer size={20} />}
          tone="neutral"
          compact
          hint={t("cards.avg_fulfillment_hint")}
        />

        <MetricCard
          title={t("cards.on_time")}
          value={formatPercent(onTimeRate)}
          icon={<Clock size={20} />}
          tone={slaTone}
          badge={t("cards.on_time_badge")}
          progress={onTimeRate}
          compact
          hint={t("cards.on_time_hint")}
        />
      </div>
    </div>
  );
});

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
