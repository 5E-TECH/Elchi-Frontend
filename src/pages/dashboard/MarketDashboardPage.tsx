import { memo, useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Plus,
  ReceiptText,
  ShoppingBag,
  XCircle,
  TrendingUp,
  Package,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../../entities/dashboard";
import { useOrders, type ExtraCostApproval } from "../../entities/orders";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import QuickDateRangeFilter from "../../shared/ui/QuickDateRangeFilter";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import MetricCard, { MetricCardSkeleton } from "../../shared/ui/MetricCard";
import TopPerformers from "../../widgets/dashboard-top-performers/ui/TopPerformers";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import type { RootState } from "../../app/config/store";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";
import {
  formatCompactMoney,
  formatNumber,
  formatPercent,
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
  const [toDate, setToDate] = useState(typeof storedToDate === "string" ? storedToDate : "");

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
    isError: dashboardError,
    refetch: refetchDashboard,
  } = getDashboard(analyticsParams, true, analyticsScope);

  const {
    data: approvalResponse,
    isLoading: approvalsLoading,
    isError: approvalsError,
  } = useExtraCostApprovals("pending", true);
  const extraCostApprovals = Array.isArray(approvalResponse?.data) ? approvalResponse.data : [];

  // ─── Hisoblangan qiymatlar ────────────────────────────────────────────────────
  const orders = data?.data?.orders;

  const accepted = orders?.acceptedCount ?? 0;
  const sold = orders?.soldAndPaid ?? 0;
  const cancelled = orders?.cancelled ?? 0;
  const profit = orders?.profit ?? 0;
  const topMarkets = data?.data?.topMarkets ?? [];

  const inProgress = orders?.inProgress ?? Math.max(0, accepted - sold - cancelled);
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
            onClick={() => navigate("/orders/add")}
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

      <ExtraCostApprovalPanel
        approvals={extraCostApprovals}
        loading={approvalsLoading}
        error={approvalsError}
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
        onApprove={(id) => approveExtraCostApproval.mutate({ id })}
        onReject={(id) => rejectExtraCostApproval.mutate({ id })}
        t={t}
      />

      {/* Marketga ruxsatli dashboard statistikasi */}
      {!dashboardError && (
        <div className="mb-5">
          <MarketStatsGrid
            accepted={accepted}
            sold={sold}
            cancelled={cancelled}
            inProgress={inProgress}
            profit={profit}
            successRate={successRate}
            loading={isDataLoading}
            t={t}
          />
        </div>
      )}

      {!dashboardError && !isDataLoading && (
        <div className="mb-5">
          <TopPerformers markets={topMarkets} />
        </div>
      )}

      {/* Tezkor harakatlar */}
      {!dashboardError && !isDataLoading && (
        <MarketQuickActions
          onViewOrders={() => navigate("/new-orders")}
          onAddOrder={canAddOrder ? () => navigate("/orders/add") : undefined}
          t={t}
        />
      )}
    </PageContainer>
  );
};

// ─── ExtraCostApprovalPanel ───────────────────────────────────────────────────

interface ExtraCostApprovalPanelProps {
  approvals: ExtraCostApproval[];
  loading: boolean;
  error: boolean;
  approvingId: string;
  rejectingId: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const formatApprovalAmount = (amount: number) =>
  new Intl.NumberFormat("uz-UZ").format(Number(amount) || 0);

const ExtraCostApprovalPanel = memo(
  ({
    approvals,
    loading,
    error,
    approvingId,
    rejectingId,
    onApprove,
    onReject,
    t,
  }: ExtraCostApprovalPanelProps) => {
    if (loading) {
      return (
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-primarydark sm:p-5">
          <div className="h-5 w-52 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"
              />
            ))}
          </div>
        </div>
      );
    }

    if (error || approvals.length === 0) {
      return null;
    }

    const actionLabel = (action: ExtraCostApproval["action"]) => {
      if (action === "cancel") return t("market.extra_cost_cancel");
      if (action === "partly_sell") return t("market.extra_cost_partly_sell");
      return t("market.extra_cost_sell");
    };

    return (
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-400/20 dark:bg-amber-400/10 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Clock size={19} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-maindark dark:text-primary">
                {t("market.extra_cost_approvals")}
              </h3>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("market.extra_cost_approvals_count", { count: approvals.length })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {approvals.map((approval) => {
            const isApproving = approvingId === approval.id;
            const isRejecting = rejectingId === approval.id;
            const busy = isApproving || isRejecting;

            return (
              <div
                key={approval.id}
                className="rounded-xl border border-amber-200 bg-white p-4 dark:border-white/10 dark:bg-primarydark"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-700 dark:text-amber-300">
                      <ReceiptText size={14} />
                      <span>{actionLabel(approval.action)}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-maindark dark:text-primary">
                      #{approval.order_id}
                    </p>
                  </div>
                  <div className="text-right text-sm font-black text-maindark dark:text-primary">
                    {formatApprovalAmount(approval.amount)} {t("currency_sum")}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <span>
                    {t("market.extra_cost_requester")}: #{approval.requested_by_user_id}
                  </span>
                  <span className="text-right">
                    {t("market.extra_cost_proofs")}: {approval.proof_file_keys?.length ?? 0}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprove(approval.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} />
                    {isApproving
                      ? t("market.extra_cost_approving")
                      : t("market.extra_cost_approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReject(approval.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
                  >
                    <XCircle size={15} />
                    {isRejecting ? t("market.extra_cost_rejecting") : t("market.extra_cost_reject")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

ExtraCostApprovalPanel.displayName = "ExtraCostApprovalPanel";

// ─── MarketStatsGrid ──────────────────────────────────────────────────────────

interface MarketStatsGridProps {
  accepted: number;
  sold: number;
  cancelled: number;
  inProgress: number;
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
    inProgress,
    profit,
    successRate,
    loading,
    t,
  }: MarketStatsGridProps) => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    const profitTone = profit < 0 ? "danger" : ("success" as const);
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t("cards.profit")}
            value={formatCompactMoney(profit)}
            suffix={t("currency_sum")}
            icon={<TrendingUp size={20} />}
            tone={profitTone}
            compact
            hint={t("cards.profit_hint")}
          />
        </div>
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
