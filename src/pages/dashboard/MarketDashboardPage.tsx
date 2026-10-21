// dizayn-v2: market-dashboard-home, market-dashboard-extra-cost-approvals
import { CircleCheck, CircleX, Plus, RefreshCw, ShoppingBag, Truck, Unlink, UsersRound, Wallet } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { fetchMyProfile } from "../../auth/authService";
import { canCreateOrders, canViewOrders } from "../../app/lib/access";
import { useDashboard } from "../../entities/dashboard";
import { hasFailedPart } from "../../entities/dashboard/lib/partialFailure";
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
import { DEFAULT_SETTINGS, useSettings } from "../../entities/settings";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../shared/lib/formatMoney";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";
import { ChartLegend } from "../../shared/ui/charts";
import { Button, Card, EmptyState, ErrorState, PageHeader, StatCard } from "../../shared/ui/primitives";
import { DashboardPartError } from "../../widgets/dashboard-part-error/ui/DashboardPartError";
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
import { isLowDataRanking } from "../../widgets/dashboard-top-performers/model/ranking";
import TopRankCard from "../../widgets/dashboard-top-performers/ui/TopRankCard";
import { ExtraCostApprovals } from "./ui/ExtraCostApprovals";
import { AutoApprovedExtraCosts } from "./ui/AutoApprovedExtraCosts";
import MarketSalesCard from "./ui/MarketSalesCard";
import QuickActions from "./ui/QuickActions";

/**
 * BOSH SAHIFA — market (maketlar `market-dashboard-home`, `market-dashboard-extra-cost-approvals`).
 *
 * Saqlanadigan xulq: faqat market uchun ruxsat etilgan `analytics/dashboard` (start/end, «Barchasi» ham
 * aniq sanalar bilan), `myStat` → `orders` zaxiralari, `add_order` ruxsati, qo'shimcha xarajat tasdiqlari
 * (`ExtraCostApprovals`: tasdiq oynasi, rad etish sababi, «allaqachon hal qilingan», `market_operator` faqat
 * ko'radi), sozlamadagi vidjetlar (`topPerformers` — «Top operatorlar», `performanceChart` — «Marketlar
 * bo'yicha sotuv foizi»). «Reytingdagi o'rningiz» va «Buyurtmalar dinamikasi» — «Taklif», chizilmaydi.
 * Qisman nosozlik (VkwhHqvW): `myStat`/`orders` olinmasa — KPI va grafiklar o'rnida xato; `topOperators` —
 * «Top operatorlar» joyida; `topMarkets` yoki `markets` — «Marketlar bo'yicha sotuv foizi» joyida xato kartasi.
 *
 * `variant="operator"` — MARKET OPERATORI bosh sahifasi (MO-2; maket yo'q — eng yaqini `market-dashboard-home`).
 * `analytics/dashboard` operatorga ochiq (backend operatorni o'z marketiga cheklaydi). Farqlar:
 *   - qo'shimcha xarajat tasdiqlari (`ExtraCostApprovals`, `AutoApprovedExtraCosts`) yo'q va so'ralmaydi —
 *     `GET orders/extra-cost-approvals` operatorga 403 (faqat o'qish ruxsati — N14, MO-8);
 *   - sarlavha izohida market nomi yo'q (profil faqat `market_id` beradi — N13), o'rnida davr;
 *   - «Marketlar bo'yicha sotuv foizi» da o'z qatori — `market_id` (operatorning o'z id'si emas);
 *   - profilda `market_id` yo'q (operator hali marketga biriktirilmagan) — `analytics/dashboard` so'ralmaydi (backend
 *     operatorning o'z id'si bilan bo'sh statistika qaytaradi — nol KPI chalg'itadi); o'rnida MH-1
 *     `products-unassigned` kabi `EmptyState` + «Qayta tekshirish» (profil qayta o'qiladi);
 *   - buyurtmalar havolalari («Buyurtmalarni ko'rish» → `/orders`, holat kartasidagi ro'yxat) faqat `canViewOrders`,
 *     «Buyurtma yaratish» faqat `canCreateOrders` bo'lsa — ikkalasi MO-3 da ochiladi (shungacha 403 ga olib bormaydi).
 */
const MarketDashboardPage = ({ variant = "market" }: { variant?: "market" | "operator" }) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const user = useSelector((state: RootState) => state.user.user);
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  const isOperator = variant === "operator";
  // Operator marketga biriktirilmagan: profil yuklangan, lekin `market_id` yo'q.
  const unassigned = isOperator && user != null && user.market_id == null;
  const [recheckingProfile, setRecheckingProfile] = useState(false);
  const ordersOpen = useSelector(canViewOrders);
  const createOpen = useSelector(canCreateOrders);

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

  const {
    data,
    isLoading,
    isFetching: dashboardFetching,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = getDashboard(analyticsParams, !unassigned, analyticsScope);
  // Oldingi teng davr (ega savoli 1 sukuti) — joriy javob kelgach, «Barchasi»da yo'q.
  const prevRange = useMemo(() => previousPeriodRange(resolveDashboardPeriod(fromDate, toDate)), [fromDate, toDate]);
  const previousParams = useMemo(
    () => (prevRange ? { start_day: prevRange.from, end_day: prevRange.to } : analyticsParams),
    [analyticsParams, prevRange],
  );
  const { data: previousData } = getDashboard(
    previousParams,
    !unassigned && Boolean(prevRange) && Boolean(data),
    analyticsScope,
  );

  // Qisman nosozlik (VkwhHqvW): olinmagan bo'lak 0 lar bilan emas, joyida xato holati bilan chiziladi.
  const failedParts = data?.data?.failedParts;
  const statsFailed = hasFailedPart(failedParts, "orders", "myStat");
  const operatorsFailed = hasFailedPart(failedParts, "topOperators");
  // «Marketlar bo'yicha sotuv foizi» = reyting (`topMarkets`) + o'z qatori (`markets`) — biri olinmasa ham chala.
  const salesRankingFailed = hasFailedPart(failedParts, "topMarkets");
  const salesFailed = salesRankingFailed || hasFailedPart(failedParts, "markets");
  const retryDashboard = () => void refetchDashboard();

  const orders = data?.data?.orders;
  const myStat = data?.data?.myStat;
  const accepted = myStat?.totalOrders ?? orders?.acceptedCount ?? 0;
  const sold = myStat?.soldOrders ?? orders?.soldAndPaid ?? 0;
  const cancelled = myStat?.canceledOrders ?? orders?.cancelled ?? 0;
  const profit = myStat?.profit ?? orders?.profit ?? 0;
  const inProgress = myStat?.inProgress ?? orders?.inProgress ?? inProgressCount(accepted, sold, cancelled);
  const successRate = myStat?.successRate ?? share(sold, accepted);

  // Oldingi davr bo'lagi olinmagan bo'lsa — 0 bilan solishtirilmaydi.
  const prevFailed = hasFailedPart(previousData?.data?.failedParts, "orders", "myStat");
  const prevStat = prevRange && !prevFailed ? previousData?.data?.myStat : undefined;
  const prevOrders = prevRange && !prevFailed ? previousData?.data?.orders : undefined;
  const prevAccepted = prevStat?.totalOrders ?? prevOrders?.acceptedCount;
  const prevSold = prevStat?.soldOrders ?? prevOrders?.soldAndPaid;
  const prevCancelled = prevStat?.canceledOrders ?? prevOrders?.cancelled;
  const prevProfit = prevStat?.profit ?? prevOrders?.profit;
  const hasPrevious = previousData != null && prevRange != null && !prevFailed;
  const prevRate =
    hasPrevious && (prevAccepted ?? 0) > 0 ? (prevStat?.successRate ?? share(prevSold ?? 0, prevAccepted ?? 0)) : null;

  const canAddOrder = isOperator ? createOpen : Boolean((user as Record<string, unknown> | null)?.add_order);
  // Operator: o'z marketi qatori — profildagi `market_id` (bo'lmasa belgilanmaydi).
  const selfId = isOperator ? (user?.market_id != null ? String(user.market_id) : undefined) : (user?.id ?? roleId);
  // Operator profilida `name` — operatorning o'z ismi, market nomi emas.
  const marketName = isOperator ? null : readProfileName(user);
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
  const salesRows: PerformerRow[] = (() => {
    const top = marketRows(data?.data?.topMarkets);
    const own = marketRows(data?.data?.markets);
    const merged = [...top];
    for (const row of own) if (!merged.some((item) => item.id === row.id)) merged.push(row);
    return sortByRate(merged);
  })();

  const operators = operatorRows(data?.data?.topOperators);
  const ordersListHref =
    isOperator && !ordersOpen
      ? undefined
      : isAllTime
        ? "/orders"
        : `/orders?startDay=${period.range.from}&endDay=${period.range.to}`;

  const createOrderButton = canAddOrder ? (
    <Button leftIcon={Plus} onClick={() => navigate("/new-orders/create")}>
      {t("v2Market.createOrder")}
    </Button>
  ) : undefined;

  const recheckProfile = () => {
    setRecheckingProfile(true);
    // Muvaffaqiyatda profil store'ga yoziladi (`market_id` kelsa sahifa o'zi ochiladi); xato — jim, tugma qaytadi.
    void fetchMyProfile()
      .catch(() => undefined)
      .finally(() => setRecheckingProfile(false));
  };

  if (unassigned) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader title={t("v2Dashboard.header.title")} description={t("v2Market.operatorUnassigned.subtitle")} />
        <Card as="section" padding="none" data-testid="operator-unassigned">
          <EmptyState
            icon={Unlink}
            title={t("v2Market.operatorUnassigned.title")}
            description={t("v2Market.operatorUnassigned.description")}
            action={
              <Button
                variant="secondary"
                leftIcon={RefreshCw}
                loading={recheckingProfile}
                loadingText={t("v2Market.operatorUnassigned.checking")}
                onClick={recheckProfile}
              >
                {t("v2Market.operatorUnassigned.retry")}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

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

      {isOperator ? null : (
        <>
          <ExtraCostApprovals />
          <AutoApprovedExtraCosts />
        </>
      )}

      {dashboardError || statsFailed ? (
        <Card>
          <ErrorState description={t("load_error")} onRetry={retryDashboard} retrying={dashboardFetching} />
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
          {statsFailed ? null : isLoading ? (
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
          {/* «Top operatorlar» — bo'sh bo'lsa karta yo'q (bo'sh joy qoldirilmaydi); olinmasa — xato kartasi. */}
          {widgets.topPerformers && !isLoading && operatorsFailed ? (
            <DashboardPartError
              data-testid="operators-ranking-failed"
              title={t("v2Dashboard.top.operators")}
              onRetry={retryDashboard}
              retrying={dashboardFetching}
            />
          ) : null}
          {widgets.topPerformers && !isLoading && !operatorsFailed && operators.length > 0 ? (
            <TopRankCard
              data-testid="operators-ranking"
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
              note={operators.length < 5 || isLowDataRanking(operators, null) ? t("v2Dashboard.top.limited") : undefined}
            />
          ) : null}
        </CardRow>
      ) : null}

      {widgets.performanceChart && !dashboardError && !isLoading && salesFailed ? (
        <DashboardPartError
          data-testid={salesRankingFailed ? "market-ranking-failed" : "performance-markets-failed"}
          title={t("v2Market.sales.title")}
          onRetry={retryDashboard}
          retrying={dashboardFetching}
        />
      ) : null}
      {widgets.performanceChart && !dashboardError && !isLoading && !salesFailed ? (
        <MarketSalesCard rows={salesRows} selfId={selfId} />
      ) : null}

      {!dashboardError && !isLoading ? (
        <QuickActions
          canAddOrder={canAddOrder}
          orders={isOperator ? (ordersOpen ? "list" : null) : "intake"}
          createMode={isOperator ? "ai" : "any"}
        />
      ) : null}
    </div>
  );
};

export default memo(MarketDashboardPage);
