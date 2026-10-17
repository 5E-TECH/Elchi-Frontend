// dizayn-v2: market-dashboard-home, market-dashboard-extra-cost-approvals
import { CircleCheck, CircleX, Plus, ShoppingBag, Truck, UsersRound, Wallet } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { useDashboard } from "../../entities/dashboard";
import {
  comparisonHint,
  percentChange,
  periodHeadline,
  periodLabel,
  previousLabel,
  previousPeriodRange,
  resolveDashboardPeriod,
  share,
} from "../../entities/dashboard/lib/period";
import { inProgressCount, readProfileName } from "../../entities/dashboard/lib/profile";
import { useOrders } from "../../entities/orders";
import { DEFAULT_SETTINGS, useSettings } from "../../entities/settings";
import { getActionErrorMessage } from "../../shared/lib/actionError";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../shared/lib/formatMoney";
import { notify } from "../../shared/lib/notify";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";
import { ChartLegend } from "../../shared/ui/charts";
import { Button, Card, EmptyState, ErrorState, StatCard } from "../../shared/ui/primitives";
import DashboardHeader from "../../widgets/dashboard-statistics/ui/DashboardHeader";
import { CardRow, KpiRow, LoadingChartCard } from "../../widgets/dashboard-statistics/ui/DashboardGrid";
import OrderStatusCard from "../../widgets/dashboard-statistics/ui/OrderStatusCard";
import SuccessRateCard from "../../widgets/dashboard-statistics/ui/SuccessRateCard";
import {
  marketRows,
  operatorRows,
  sortByRate,
  toRankItems,
  type PerformerRow,
} from "../../widgets/dashboard-top-performers/lib/rankItems";
import TopRankCard from "../../widgets/dashboard-top-performers/ui/TopRankCard";
import ExtraCostApprovalsCard from "./ui/ExtraCostApprovalsCard";
import MarketSalesCard from "./ui/MarketSalesCard";
import QuickActions from "./ui/QuickActions";

/**
 * BOSH SAHIFA — market (maketlar `market-dashboard-home`, `market-dashboard-extra-cost-approvals`).
 *
 * Saqlanadigan xulq: faqat market uchun ruxsat etilgan `analytics/dashboard` (start/end, «Barchasi» ham
 * aniq sanalar bilan), `myStat` → `orders` zaxiralari, `add_order` ruxsati, qo'shimcha xarajat tasdiqlari
 * (`approve/rejectExtraCostApproval.mutate` + xato `notify`), sozlamadagi vidjetlar (`topPerformers` —
 * «Top operatorlar», `performanceChart` — «Marketlar bo'yicha sotuv foizi»). «Reytingdagi o'rningiz» va
 * «Buyurtmalar dinamikasi» — «Taklif», chizilmaydi.
 */
const MarketDashboardPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const user = useSelector((state: RootState) => state.user.user);
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);

  const [fromDate, setFromDate] = useState(typeof storedFromDate === "string" ? storedFromDate : "");
  const [toDate, setToDate] = useState(typeof storedToDate === "string" ? storedToDate : "");
  const { data: settingsData } = useSettings();
  const widgets = (settingsData ?? DEFAULT_SETTINGS).dashboard.widgets;

  const hasDateFilter = Boolean(fromDate && toDate);
  const isAllTime = (() => {
    const all = getAllTimeRange();
    return fromDate === all.from && toDate === all.to;
  })();
  const period = resolveDashboardPeriod(fromDate, toDate);
  const analyticsScope = useMemo(() => `${role ?? "unknown"}:${user?.id ?? "unknown"}`, [role, user?.id]);
  const analyticsParams = useMemo(
    () => ({ start_day: hasDateFilter ? fromDate : "", end_day: hasDateFilter ? toDate : "" }),
    [fromDate, hasDateFilter, toDate],
  );

  const { getDashboard } = useDashboard();
  const { useExtraCostApprovals, approveExtraCostApproval, rejectExtraCostApproval } = useOrders();

  // fix3 FE-ORD-02: tasdiqlash/rad etish rad javobi ko'rinadi.
  const notifyApprovalError = useCallback(
    (error: unknown) => {
      const description = getActionErrorMessage(error, t("market.extra_cost_action_error"));
      if (!description) return;
      notify.error(t("common:error"), { description });
    },
    [t],
  );

  const { data, isLoading, isError: dashboardError, refetch: refetchDashboard } = getDashboard(
    analyticsParams,
    true,
    analyticsScope,
  );
  // Oldingi teng davr (ega savoli 1 sukuti) — joriy javob kelgach, «Barchasi»da yo'q.
  const prevRange = useMemo(() => previousPeriodRange(resolveDashboardPeriod(fromDate, toDate)), [fromDate, toDate]);
  const previousParams = useMemo(
    () => (prevRange ? { start_day: prevRange.from, end_day: prevRange.to } : analyticsParams),
    [analyticsParams, prevRange],
  );
  const { data: previousData } = getDashboard(previousParams, Boolean(prevRange) && Boolean(data), analyticsScope);

  const {
    data: approvalResponse,
    isLoading: approvalsLoading,
    isError: approvalsError,
  } = useExtraCostApprovals("pending", true);
  const extraCostApprovals = Array.isArray(approvalResponse?.data) ? approvalResponse.data : [];

  const orders = data?.data?.orders;
  const myStat = data?.data?.myStat;
  const accepted = myStat?.totalOrders ?? orders?.acceptedCount ?? 0;
  const sold = myStat?.soldOrders ?? orders?.soldAndPaid ?? 0;
  const cancelled = myStat?.canceledOrders ?? orders?.cancelled ?? 0;
  const profit = myStat?.profit ?? orders?.profit ?? 0;
  const inProgress = myStat?.inProgress ?? orders?.inProgress ?? inProgressCount(accepted, sold, cancelled);
  const successRate = myStat?.successRate ?? share(sold, accepted);

  const prevStat = prevRange ? previousData?.data?.myStat : undefined;
  const prevOrders = prevRange ? previousData?.data?.orders : undefined;
  const prevAccepted = prevStat?.totalOrders ?? prevOrders?.acceptedCount;
  const prevSold = prevStat?.soldOrders ?? prevOrders?.soldAndPaid;
  const prevCancelled = prevStat?.canceledOrders ?? prevOrders?.cancelled;
  const prevProfit = prevStat?.profit ?? prevOrders?.profit;
  const hasPrevious = previousData != null && prevRange != null;
  const prevRate =
    hasPrevious && (prevAccepted ?? 0) > 0 ? (prevStat?.successRate ?? share(prevSold ?? 0, prevAccepted ?? 0)) : null;

  const canAddOrder = Boolean((user as Record<string, unknown> | null)?.add_order);
  const selfId = user?.id ?? roleId;
  const marketName = readProfileName(user);
  const periodText = periodLabel(t, period);
  const hint = comparisonHint(t, period);
  /** KPI delta va izohi («kechaga nisbatan»): delta bo'lmasa (oldingi davr yo'q, asos 0) — izoh ham yo'q. */
  const deltaProps = (value: number | null) => ({ delta: value, hint: value != null ? hint : undefined });
  const count = (value: number) => formatNumberLocalized(value, { language });

  const applyRange = useCallback(
    (range: { from: string; to: string }) => {
      setFromDate(range.from);
      setToDate(range.to);
      dispatch(setMultipleFilters({ dashboardFromDate: range.from, dashboardToDate: range.to }));
    },
    [dispatch],
  );
  const clearRange = useCallback(() => {
    setFromDate("");
    setToDate("");
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
  }, [dispatch]);

  const delta = (current: number, previous: number | undefined) => (hasPrevious ? percentChange(current, previous) : null);

  // «Marketlar bo'yicha sotuv foizi»: reyting (`topMarkets`) + o'z qatori (`markets` — RBAC-02, faqat o'zi).
  // O'z qatori har doim ko'rinadi (≥ 30 buyurtma chegarasidan o'tmagan bo'lsa ham) — hozirgi `chartMarkets` xulqi.
  const salesRows: PerformerRow[] = useMemo(() => {
    const top = marketRows(data?.data?.topMarkets);
    const own = marketRows(data?.data?.markets);
    const merged = [...top];
    for (const row of own) if (!merged.some((item) => item.id === row.id)) merged.push(row);
    return sortByRate(merged);
  }, [data?.data?.markets, data?.data?.topMarkets]);

  const operators = operatorRows(data?.data?.topOperators);
  const ordersListHref = isAllTime ? "/orders" : `/orders?startDay=${period.range.from}&endDay=${period.range.to}`;

  const createOrderButton = canAddOrder ? (
    <Button leftIcon={Plus} onClick={() => navigate("/new-orders/create")}>
      {t("v2Market.createOrder")}
    </Button>
  ) : undefined;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <DashboardHeader
        description={
          marketName
            ? t("v2Market.headerSub", { name: marketName })
            : periodHeadline(t, period)
        }
        fromDate={fromDate}
        toDate={toDate}
        onChange={applyRange}
        onClear={clearRange}
        primaryAction={createOrderButton}
      />

      <ExtraCostApprovalsCard
        approvals={extraCostApprovals}
        loading={approvalsLoading}
        error={approvalsError}
        approvingId={approveExtraCostApproval.isPending ? String(approveExtraCostApproval.variables?.id ?? "") : ""}
        rejectingId={rejectExtraCostApproval.isPending ? String(rejectExtraCostApproval.variables?.id ?? "") : ""}
        onApprove={(id) => approveExtraCostApproval.mutate({ id }, { onError: notifyApprovalError })}
        onReject={(id) => rejectExtraCostApproval.mutate({ id }, { onError: notifyApprovalError })}
      />

      {dashboardError ? (
        <Card>
          <ErrorState description={t("load_error")} onRetry={() => void refetchDashboard()} />
        </Card>
      ) : (
        <KpiRow count={4} label={t("v2Dashboard.kpi.label")}>
          <div data-testid="market-stats-grid" className="contents">
            <StatCard
              label={t("cards.total_orders")}
              icon={ShoppingBag}
              loading={isLoading}
              value={count(accepted)}
              unit={t("unit.orders")}
              {...deltaProps(delta(accepted, prevAccepted))}
              goodWhen="none"
            />
            <StatCard
              label={t("cards.sold")}
              icon={CircleCheck}
              loading={isLoading}
              value={count(sold)}
              unit={t("unit.orders")}
              {...deltaProps(delta(sold, prevSold))}
            />
            <StatCard
              label={t("cards.cancelled")}
              icon={CircleX}
              loading={isLoading}
              value={count(cancelled)}
              unit={t("unit.orders")}
              {...deltaProps(delta(cancelled, prevCancelled))}
              goodWhen="down"
            />
            <StatCard
              label={t("cards.profit")}
              icon={Wallet}
              loading={isLoading}
              value={formatMoneyLocalized(profit, { language, withCurrency: false })}
              unit={CURRENCY_LABEL[resolveMoneyLanguage(language)]}
              valueTone={profit < 0 ? "danger" : undefined}
              {...deltaProps(delta(profit, prevProfit))}
            />
          </div>
        </KpiRow>
      )}


      {!dashboardError ? (
        <CardRow>
          {isLoading ? (
            <>
              <LoadingChartCard title={t("v2Dashboard.success.title")} />
              <LoadingChartCard title={t("v2Dashboard.status.title")} />
            </>
          ) : (
            <>
              <SuccessRateCard
                rate={successRate}
                sold={sold}
                cancelled={cancelled}
                description={t("v2Dashboard.success.subTotal", { period: periodText })}
                gaugeLabel={t("v2Dashboard.success.gaugeTotal")}
                previous={prevRate != null ? { rate: prevRate, label: previousLabel(t, period) } : null}
              />
              <OrderStatusCard
                total={accepted}
                description={t("v2Market.statusSub", { period: periodText, count: count(accepted) })}
                centerLabel={t("v2Market.statusCenter")}
                listHref={ordersListHref}
                note={t("v2Dashboard.status.inProgressNote")}
                segments={[
                  { key: "sold", label: t("v2Dashboard.status.sold"), value: sold, tone: "success", icon: CircleCheck },
                  { key: "progress", label: t("v2Dashboard.status.inProgress"), value: inProgress, tone: "warning", icon: Truck },
                  { key: "cancelled", label: t("v2Dashboard.status.cancelled"), value: cancelled, tone: "danger", icon: CircleX },
                ]}
              />
            </>
          )}
          {/* «Top operatorlar» — bo'sh bo'lsa karta yo'q (bo'sh joy qoldirilmaydi). */}
          {widgets.topPerformers && !isLoading && operators.length > 0 ? (
            <TopRankCard
              title={t("v2Dashboard.top.operators")}
              description={t("v2Dashboard.top.sub")}
              items={toRankItems(operators, { t, language })}
              expandable
              meterTarget={successRate}
              empty={<EmptyState size="chart" icon={UsersRound} title={t("v2Dashboard.top.emptyTitle")} />}
              footer={
                <ChartLegend
                  items={[
                    { key: "rate", tone: "action", keyClassName: "bg-chart-1", label: t("v2Market.operatorRate") },
                    {
                      key: "avg",
                      tone: "neutral",
                      shape: "target",
                      label: t("v2Market.marketAverage", {
                        name: marketName ?? t("v2Market.yourMarket"),
                        rate: formatPercentLocalized(successRate, { language }),
                      }),
                    },
                  ]}
                />
              }
              note={operators.length < 5 ? t("v2Dashboard.top.limited") : undefined}
            />
          ) : null}
        </CardRow>
      ) : null}

      {widgets.performanceChart && !dashboardError && !isLoading ? (
        <MarketSalesCard rows={salesRows} selfId={selfId} />
      ) : null}

      {!dashboardError && !isLoading ? <QuickActions canAddOrder={canAddOrder} /> : null}
    </div>
  );
};

export default memo(MarketDashboardPage);
