// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, courier-dashboard-home, courier-dashboard-pwa-install
import { Banknote, CircleCheck, CircleX, Package, ReceiptText, TrendingDown, Trophy, Truck, Wallet } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
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
  splitCompactMoney,
  isDashboardQuickKey,
  type DashboardQuickKey,
} from "../../entities/dashboard/lib/period";
import { inProgressCount, readProfileBranchName } from "../../entities/dashboard/lib/profile";
import { clampedAllTimeWindow, getEffectiveAllTimeRange } from "../../entities/dashboard/lib/allTime";
import { seriesValues } from "../../entities/dashboard/lib/trend";
import { DEFAULT_SETTINGS, useSettings } from "../../entities/settings";
import { InstallAppCard } from "../../features/pwa-install";
import { getAllTimeRange } from "../../shared/lib/dateRange";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../shared/lib/formatMoney";
import { removeFilterValue, setMultipleFilters } from "../../shared/model/filterSlice";
import DeferredMount from "../../shared/ui/DeferredMount";
import { Sparkline } from "../../shared/ui/charts";
import { Card, EmptyState, ErrorState, StatCard } from "../../shared/ui/primitives";
import { DashboardPartError } from "../../widgets/dashboard-part-error/ui/DashboardPartError";
import RegionOverviewCard from "../../widgets/dashboard-region/ui/RegionOverviewCard";
import DashboardHeader from "../../widgets/dashboard-statistics/ui/DashboardHeader";
import { CardRow, KpiRow, LoadingChartCard } from "../../widgets/dashboard-statistics/ui/DashboardGrid";
import OrderStatusCard from "../../widgets/dashboard-statistics/ui/OrderStatusCard";
import SuccessRateCard from "../../widgets/dashboard-statistics/ui/SuccessRateCard";
import {
  branchRows,
  courierRows,
  lowRateTone,
  marketRows,
  sortByRate,
  toRankItems,
} from "../../widgets/dashboard-top-performers/lib/rankItems";
import { isLowDataRanking, rankingDescription } from "../../widgets/dashboard-top-performers/model/ranking";
import TopRankCard from "../../widgets/dashboard-top-performers/ui/TopRankCard";
import FinancialAnalysis from "../../widgets/financial-analysis/ui/FinancialAnalysis";
import CourierCashCard from "./ui/CourierCashCard";
import CourierPlanCard from "./ui/CourierPlanCard";
import DeliveryQualityCard from "./ui/DeliveryQualityCard";
import DeliveryResultsCard from "./ui/DeliveryResultsCard";

/**
 * BOSH SAHIFA — superadmin, admin, registrator, kuryer (va operator). Market — `MarketDashboardPage`,
 * menejer — `/branch-dashboard`.
 *
 * Saqlanadigan xulq: davr redux'da (`filter.dashboardFromDate/ToDate`), «Barchasi» → `{ all: true }`,
 * kpi faqat SA/admin (backend 403 — Audit P1-2; «Barchasi»da ham `all=true` bilan — XdKajqLe), operator — faqat
 * asosiy kartalar (backend operatorni filialga cheklamaydi), kuryer — `myStat` + `topCouriers`.
 * Oldingi teng davr (delta, «Kecha · %») va 14 kunlik sparkline (DwrMygfo) — SA/admin uchun joriy javobning o'zidagi
 * `previous` / `series` (dashboard va kpi), ikkinchi og'ir so'rov yo'q. Kuryer dashboardida `previous` yo'q — unda
 * oldingi davr hamon alohida so'rov (joriy javobdan keyin). «Yo'qotilgan daromad» va «maqsad 80%» — l9NNdsCH.
 * Grafiklar — `shared/ui/charts` (oddiy SVG); recharts faqat «Moliyaviy tahlil» plotida (lazy, §1.9).
 * Qisman nosozlik (VkwhHqvW): `failedParts` dagi bo'lak 0 lar bilan emas, o'z kartasi joyida
 * `DashboardPartError` («Ma'lumotni yuklab bo'lmadi» + «Qayta urinish») bilan chiziladi.
 */
/**
 * KPI javobida statistikada chiziladigan ko'rsatkichlar olinmadimi (VkwhHqvW): `fulfillment` — yetkazish
 * vaqti / SLA, yoki qaysi bo'lak ekani aytilmagan. Boshqa bo'lak (masalan `marketRating`) hisobga olinmaydi.
 */
const kpiStatsMissing = (kpi: { degraded?: boolean; failedParts?: string[] } | undefined) => {
  if (!kpi?.degraded) return false;
  const parts = kpi.failedParts ?? [];
  return parts.length === 0 || hasFailedPart(parts, "fulfillment", "averageOrderValue", "averageFulfillmentHours", "onTimeRate");
};

const DashboardPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const dispatch = useDispatch();
  const storedFromDate = useSelector((state: RootState) => state.filter.dashboardFromDate);
  const storedToDate = useSelector((state: RootState) => state.filter.dashboardToDate);
  const storedPreset = useSelector((state: RootState) => state.filter.dashboardPreset);
  const user = useSelector((state: RootState) => state.user.user);
  const role = useSelector((state: RootState) => state.role.role);
  const roleId = useSelector((state: RootState) => state.role.id);
  const analyticsScope = `${role || "unknown"}:${user?.id || "unknown"}`;
  const normalizedRole = String(role || "").toLowerCase();
  // KPI va daromad analitikasi backendda faqat SUPERADMIN/ADMIN — boshqa rollarga so'rov yuborilmaydi (403).
  const isAnalyticsAdmin = ["superadmin", "admin"].includes(normalizedRole);
  const isCourier = normalizedRole === "courier";
  // Operator: backend rolga xos doira bermaydi — kompaniya reytinglari va hududlar ko'rsatilmaydi.
  const isOperator = normalizedRole === "operator";
  const isRegistrator = normalizedRole === "registrator";
  const canShowCompanyBlocks = !isCourier && !isOperator;

  const [fromDate, setFromDate] = useState(typeof storedFromDate === "string" ? storedFromDate : "");
  const [toDate, setToDate] = useState(typeof storedToDate === "string" ? storedToDate : "");
  // Bosilgan tez tanlov: dushanba «Bu hafta», oyning 1-kuni «Bu oy» oralig'i «Bugun» bilan bir xil.
  const [preset, setPreset] = useState<DashboardQuickKey | null>(
    isDashboardQuickKey(storedPreset) ? storedPreset : null,
  );
  const { data: settingsData } = useSettings();
  const widgets = (settingsData ?? DEFAULT_SETTINGS).dashboard.widgets;

  const hasDateFilter = Boolean(fromDate && toDate);
  const allTimeRange = getAllTimeRange();
  const isAllTime = fromDate === allTimeRange.from && toDate === allTimeRange.to;
  const period = resolveDashboardPeriod(fromDate, toDate, preset);

  const applyRange = useCallback(
    (range: { from: string; to: string }, nextPreset: DashboardQuickKey | null = null) => {
      setFromDate(range.from);
      setToDate(range.to);
      setPreset(nextPreset);
      dispatch(
        setMultipleFilters({ dashboardFromDate: range.from, dashboardToDate: range.to, dashboardPreset: nextPreset }),
      );
    },
    [dispatch],
  );
  const clearRange = useCallback(() => {
    setFromDate("");
    setToDate("");
    dispatch(removeFilterValue("dashboardFromDate"));
    dispatch(removeFilterValue("dashboardToDate"));
    dispatch(removeFilterValue("dashboardPreset"));
    setPreset(null);
  }, [dispatch]);

  const { getDashboard, getKpi } = useDashboard();
  const analyticsParams = useMemo(
    () =>
      isAllTime
        ? { all: true }
        : { start_day: hasDateFilter ? fromDate : "", end_day: hasDateFilter ? toDate : "" },
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
  const kpiEnabled = widgets.stats && isAnalyticsAdmin;
  const { data: kpiData, isLoading: kpiLoading, isError: kpiError, refetch: refetchKpi } = getKpi(
    analyticsParams,
    kpiEnabled,
    analyticsScope,
  );

  // Oldingi teng davr (bugun → kecha). SA/admin: joriy javobning `previous` bo'lagi (DwrMygfo) — ikkinchi so'rov yo'q.
  // Kuryer dashboardida `previous` yo'q — faqat unda oldingi davr alohida so'raladi (joriy javob kelgach).
  const prevRange = useMemo(
    () => previousPeriodRange(resolveDashboardPeriod(fromDate, toDate, preset)),
    [fromDate, preset, toDate],
  );
  const previousParams = useMemo(
    () => (prevRange ? { start_day: prevRange.from, end_day: prevRange.to } : analyticsParams),
    [analyticsParams, prevRange],
  );
  const wantsCourierPrevious = Boolean(prevRange) && isCourier;
  const { data: previousData } = getDashboard(previousParams, wantsCourierPrevious && Boolean(data), analyticsScope);

  const orders = data?.data?.orders;
  const courierStat = data?.data?.myStat;
  const kpi = kpiData?.data;
  // Oldingi davr bo'lagi olinmagan bo'lsa (VkwhHqvW, `failed_parts: trend`) — `previous: null`: 0 bilan
  // solishtirilmaydi, delta yashiriladi.
  const previousOrders = isAnalyticsAdmin && widgets.stats && !isAllTime ? (data?.data?.previous ?? undefined) : undefined;
  const series = isAnalyticsAdmin ? data?.data?.series : null;
  const previousFailed = previousData?.data?.failedParts;
  const previousCourierStat =
    wantsCourierPrevious && !hasFailedPart(previousFailed, "myStat") ? previousData?.data?.myStat : undefined;
  const previousKpi = isAllTime || kpiStatsMissing(kpi) ? undefined : (kpi?.previous ?? undefined);
  const kpiSeries = kpiStatsMissing(kpi) ? null : kpi?.series;
  const successTarget = isAnalyticsAdmin ? (data?.data?.targets?.successRate ?? null) : null;

  // Qisman nosozlik (VkwhHqvW): olinmagan bo'lak 0 lar bilan emas, joyida xato holati bilan chiziladi.
  const failedParts = data?.data?.failedParts;
  // KPI: faqat statistikada chiziladigan ko'rsatkichlar olinmasa — boshqa bo'lak statistikani yashirmaydi.
  const kpiStatsFailed = kpiStatsMissing(kpiData?.data);
  const statsFailed = dashboardError || hasFailedPart(failedParts, "orders") || (kpiEnabled && (kpiError || kpiStatsFailed));
  const retryDashboard = () => void refetchDashboard();
  const partError = (title: string, testId: string) => (
    <DashboardPartError data-testid={testId} title={title} onRetry={retryDashboard} retrying={dashboardFetching} />
  );

  const periodText = periodLabel(t, period);
  const hint = comparisonHint(t, period);
  // «Barchasi»: backend oraliqni 366 kunga qisqartirgan bo'lsa — «oxirgi 366 kun» izohi (XdKajqLe).
  const kpiClamped = isAllTime ? clampedAllTimeWindow(kpi?.appliedRange ?? data?.data?.appliedRange) : null;
  const kpiAllTimeNote = kpiClamped ? t("v2Dashboard.allTime.clamped", { days: kpiClamped.days }) : null;
  /** KPI delta va izohi («kechaga nisbatan»): delta bo'lmasa (oldingi davr yo'q, asos 0) — izoh ham yo'q. */
  const deltaProps = (value: number | null) => ({ delta: value, hint: value != null ? hint : undefined });
  const prevName = previousLabel(t, period);
  const branchName = readProfileBranchName(user);
  const count = (value: number) => formatNumberLocalized(value, { language });

  const description = isAnalyticsAdmin
    ? t("v2Dashboard.header.company", { headline: periodHeadline(t, period) })
    : branchName
      ? t("v2Dashboard.header.scoped", { headline: periodHeadline(t, period), scope: branchName })
      : periodHeadline(t, period);

  // «Ro'yxat ›» — `/orders` URL kalitlari (`orderFilterModel.ts`: `startDay` / `endDay`); «Barchasi» — filtrsiz.
  const ordersListHref = isAllTime ? "/orders" : `/orders?startDay=${period.range.from}&endDay=${period.range.to}`;

  // ─── Umumiy hisoblar (SA/admin/registrator/operator) ─────────────────────────
  const accepted = orders?.acceptedCount ?? 0;
  const sold = orders?.soldAndPaid ?? 0;
  const cancelled = orders?.cancelled ?? 0;
  const inProgress = inProgressCount(accepted, sold, cancelled);
  const successRate = share(sold, accepted);
  const previousRate =
    previousOrders && previousOrders.acceptedCount > 0 ? share(previousOrders.soldAndPaid, previousOrders.acceptedCount) : null;
  const moneyCompact = (value: number) => formatCompactMoneyLocalized(value, { language });
  /** Sparkline ma'nosi (ekran o'quvchi): «Jami daromad, oxirgi 14 kun: kuniga 2,1 – 9,6 mln so'm, oxirgi kun 4,9 mln so'm». */
  const sparkline = (label: string, values: number[] | null, format: (value: number) => string = moneyCompact) =>
    values ? (
      <Sparkline
        values={values}
        label={t("v2Dashboard.kpi.sparkAria", {
          label,
          days: values.length,
          min: format(Math.min(...values)),
          max: format(Math.max(...values)),
          last: format(values[values.length - 1]),
        })}
      />
    ) : undefined;

  const statusSegments = [
    { key: "sold", label: t("v2Dashboard.status.sold"), value: sold, tone: "success" as const, icon: CircleCheck },
    { key: "progress", label: t("v2Dashboard.status.inProgress"), value: inProgress, tone: "warning" as const, icon: Truck },
    { key: "cancelled", label: t("v2Dashboard.status.cancelled"), value: cancelled, tone: "danger" as const, icon: CircleX },
  ];

  const renderKpis = () => {
    if (!isAnalyticsAdmin) return null;
    const loading = isLoading || kpiLoading;
    const revenue = splitCompactMoney(orders?.totalRevenue ?? 0, language);
    const profit = splitCompactMoney(orders?.profit ?? 0, language);
    const lostRevenue = orders?.lostRevenue;
    const lost = splitCompactMoney(lostRevenue ?? 0, language);
    const average = kpi?.averageOrderValue ?? 0;
    const delta = (current: number | null | undefined, previous: number | null | undefined) =>
      previousOrders ? percentChange(current, previous) : null;
    const labels = {
      revenue: t("v2Dashboard.kpi.totalRevenue"),
      profit: t("v2Dashboard.kpi.netProfit"),
      average: t("v2Dashboard.kpi.avgOrder"),
      lost: t("v2Dashboard.kpi.lostRevenue"),
    };
    const averageFormat = (value: number) => formatMoneyLocalized(value, { language });
    return (
      <KpiRow count={4} label={t("v2Dashboard.kpi.label")}>
        <StatCard
          data-kpi="revenue"
          label={labels.revenue}
          icon={ReceiptText}
          loading={loading}
          value={revenue.value}
          unit={revenue.unit}
          {...deltaProps(delta(orders?.totalRevenue, previousOrders?.totalRevenue))}
        >
          {sparkline(labels.revenue, seriesValues(series, (point) => point.totalRevenue))}
        </StatCard>
        <StatCard
          data-kpi="profit"
          label={labels.profit}
          icon={Wallet}
          loading={loading}
          value={profit.value}
          unit={profit.unit}
          valueTone={(orders?.profit ?? 0) < 0 ? "danger" : undefined}
          {...deltaProps(delta(orders?.profit, previousOrders?.profit))}
        >
          {sparkline(labels.profit, seriesValues(series, (point) => point.profit))}
        </StatCard>
        <StatCard
          data-kpi="average"
          label={labels.average}
          icon={Banknote}
          loading={loading}
          value={formatMoneyLocalized(average, { language, withCurrency: false })}
          unit={CURRENCY_LABEL[resolveMoneyLanguage(language)]}
          {...deltaProps(previousKpi ? percentChange(average, previousKpi.averageOrderValue) : null)}
        >
          {sparkline(labels.average, seriesValues(kpiSeries, (point) => point.averageOrderValue), averageFormat)}
        </StatCard>
        {/* l9NNdsCH: bekor qilingan buyurtmalar summasi — kamayishi yaxshi. Backend bermasa (eski javob) — «—». */}
        <StatCard
          data-kpi="lostRevenue"
          label={labels.lost}
          icon={TrendingDown}
          loading={loading}
          value={lostRevenue == null ? "—" : lost.value}
          unit={lostRevenue == null ? undefined : lost.unit}
          goodWhen="down"
          {...deltaProps(lostRevenue == null ? null : delta(lostRevenue, previousOrders?.lostRevenue))}
        >
          {sparkline(labels.lost, seriesValues(series, (point) => point.lostRevenue))}
        </StatCard>
      </KpiRow>
    );
  };

  const renderStats = () => {
    if (!widgets.stats || isCourier) return null;
    if (statsFailed) {
      return (
        <Card>
          <ErrorState
            description={t("load_error")}
            onRetry={() => void (!kpiEnabled ? refetchDashboard() : Promise.all([refetchDashboard(), refetchKpi()]))}
          />
        </Card>
      );
    }
    const successDescription = isAnalyticsAdmin
      ? successTarget != null
        ? t("v2Dashboard.success.subTarget", {
            period: periodText,
            target: formatPercentLocalized(successTarget, { language }),
          })
        : t("v2Dashboard.success.subAccepted", { period: periodText })
      : t("v2Dashboard.success.subScoped", { period: periodText, scope: branchName ?? t("v2Dashboard.success.subAcceptedShort") });
    return (
      <>
        {renderKpis()}
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
                description={successDescription}
                gaugeLabel={t("v2Dashboard.success.gaugeAccepted")}
                previous={isAnalyticsAdmin && previousRate != null ? { rate: previousRate, label: prevName } : null}
                showThreshold={!isRegistrator}
                target={successTarget}
                note={isRegistrator ? t("v2Dashboard.success.zonesNote") : undefined}
              />
              <OrderStatusCard
                segments={statusSegments}
                total={accepted}
                description={t("v2Dashboard.status.subAccepted", { period: periodText })}
                centerLabel={t("v2Dashboard.status.centerAccepted")}
                listHref={ordersListHref}
                note={t("v2Dashboard.status.inProgressNote")}
              />
            </>
          )}
          {isAnalyticsAdmin ? (
            <DeliveryQualityCard
              description={[periodText, previousKpi ? hint : kpiAllTimeNote].filter(Boolean).join(" · ")}
              kpi={kpi}
              previous={previousKpi}
              loading={kpiLoading || isLoading}
              accepted={accepted}
              cancelled={cancelled}
            />
          ) : isLoading ? (
            <LoadingChartCard title={t("v2Dashboard.results.title")} />
          ) : (
            <DeliveryResultsCard
              description={t("v2Dashboard.results.sub", { period: periodText })}
              accepted={accepted}
              sold={sold}
              cancelled={cancelled}
              inProgress={inProgress}
            />
          )}
        </CardRow>
      </>
    );
  };

  // ─── Reytinglar ──────────────────────────────────────────────────────────────
  const renderRankings = () => {
    if (!canShowCompanyBlocks) return null;
    const showMarketsBranches = widgets.topPerformers;
    const showCouriers = widgets.performanceChart;
    if (!showMarketsBranches && !showCouriers) return null;
    if (dashboardError) {
      return widgets.stats ? null : (
        <Card>
          <ErrorState description={t("load_error")} onRetry={() => void refetchDashboard()} />
        </Card>
      );
    }
    if (isLoading) {
      return (
        <CardRow>
          {showMarketsBranches ? <LoadingChartCard data-testid="ranking-markets" title={t("v2Dashboard.top.markets")} /> : null}
          {showMarketsBranches ? <LoadingChartCard data-testid="ranking-branches" title={t("v2Dashboard.top.branches")} /> : null}
          {showCouriers ? <LoadingChartCard data-testid="ranking-couriers" title={t("v2Dashboard.top.couriers")} /> : null}
        </CardRow>
      );
    }
    const sub = t("v2Dashboard.top.sub");
    const lastDays = (count: number) => t("v2Dashboard.top.periodLastDays", { count });
    const limitedNote = t("v2Dashboard.top.limited");
    // PMa5dgYQ: sotuv foizi 50% dan past qator — qizil meter (market rolidagi «Past» bilan bir xil chegara).
    const rankOptions = { t, language, meterToneFor: lowRateTone };
    // «Top marketlar» — backend reytingi (chegara bilan); «Yana ko'rsatish» — to'liq `markets` statistikasi
    // (`markets` bo'lagi olinmagan bo'lsa — faqat reyting, ro'yxat ochilmaydi).
    const topMarketRows = marketRows(data?.data?.topMarkets);
    const allMarketRows = hasFailedPart(failedParts, "markets") ? [] : sortByRate(marketRows(data?.data?.markets));
    const marketItems = toRankItems(topMarketRows.length ? topMarketRows : allMarketRows, rankOptions);
    const allMarketItems = toRankItems(allMarketRows.length ? allMarketRows : topMarketRows, rankOptions);
    const topBranchRows = branchRows(data?.data?.topBranches);
    const branchItems = toRankItems(topBranchRows, rankOptions);
    const branchMeta = data?.data?.topBranchesMeta;
    const marketMeta = data?.data?.topMarketsMeta;
    // SA/admin uchun backend `topCouriers` yubormaydi — `couriers` (courier_stats) dan saralanadi.
    const allCourierRows = sortByRate(courierRows(data?.data?.couriers?.length ? data.data.couriers : data?.data?.topCouriers));
    const couriersFailed = hasFailedPart(failedParts, "couriers") && !data?.data?.topCouriers?.length;
    const courierItems = toRankItems(allCourierRows, rankOptions);
    const emptyRanking = <EmptyState size="chart" icon={Trophy} title={t("v2Dashboard.top.emptyTitle")} description={t("v2Dashboard.top.emptyHint")} />;
    // «Top marketlar / filiallar» bo'sh — ixcham holat (9zbSDkUI), karta qo'shnisiga cho'zilmaydi.
    const emptyPeriodRanking = <EmptyState size="inline" icon={Trophy} title={t("v2Dashboard.top.emptyPeriod")} />;
    return (
      <CardRow>
        {showMarketsBranches ? (
          hasFailedPart(failedParts, "topMarkets") ? (
            partError(t("v2Dashboard.top.markets"), "ranking-markets")
          ) : (
            <TopRankCard
              data-testid="ranking-markets"
              title={t("v2Dashboard.top.markets")}
              description={rankingDescription(sub, marketMeta, lastDays)}
              items={marketItems}
              expandedItems={showCouriers ? allMarketItems : undefined}
              expandable={showCouriers}
              empty={emptyPeriodRanking}
              note={isLowDataRanking(topMarketRows, marketMeta) ? limitedNote : undefined}
            />
          )
        ) : null}
        {showMarketsBranches ? (
          hasFailedPart(failedParts, "topBranches") ? (
            partError(t("v2Dashboard.top.branches"), "ranking-branches")
          ) : (
            <TopRankCard
              data-testid="ranking-branches"
              title={t("v2Dashboard.top.branches")}
              description={rankingDescription(sub, branchMeta, lastDays)}
              items={branchItems}
              empty={emptyPeriodRanking}
              note={
                branchItems.length > 0 && (isLowDataRanking(topBranchRows, branchMeta) || branchItems.length < 5)
                  ? limitedNote
                  : undefined
              }
            />
          )
        ) : null}
        {showCouriers && couriersFailed ? partError(t("v2Dashboard.top.couriers"), "ranking-couriers") : null}
        {showCouriers && !couriersFailed ? (
          <TopRankCard
            data-testid="ranking-couriers"
            title={t("v2Dashboard.top.couriers")}
            description={sub}
            items={courierItems}
            expandable
            // XdKajqLe: «Barchasi»da ham backend `couriers` beradi (uN1tjjGu) — bo'sh bo'lsa odatdagi bo'sh holat.
            empty={emptyRanking}
          />
        ) : null}
      </CardRow>
    );
  };

  // ─── Kuryer ──────────────────────────────────────────────────────────────────
  const renderCourier = () => {
    if (!isCourier) return null;
    if (dashboardError || (!isLoading && !courierStat)) {
      return (
        <Card>
          <ErrorState
            description={t(dashboardError ? "load_error" : "courier_stats_unavailable")}
            onRetry={() => void refetchDashboard()}
          />
        </Card>
      );
    }
    const stat = courierStat;
    const prev = previousCourierStat;
    const loading = isLoading || !stat;
    const delta = (current?: number, previous?: number) => (prev ? percentChange(current, previous) : null);
    const topCouriers = data?.data?.topCouriers ?? [];
    const selfId = user?.id ?? roleId;
    const courierItems = toRankItems(courierRows(topCouriers), {
      t,
      language,
      selfId,
      selfBadge: { label: t("v2Dashboard.top.you"), tone: "info" },
      selfMeterTone: "action",
      othersMeterTone: "neutral",
    });
    const myRank = data?.data?.myRank ?? null;
    const myRanking = data?.data?.myRanking ?? null;
    const above = myRank && myRank > 1 ? topCouriers[myRank - 2] : undefined;
    const gap = above && myRanking ? Math.max(0, Number(above.success_rate) - Number(myRanking.success_rate)) : null;
    const meta = data?.data?.topCouriersMeta;
    const courierRankingFailed = hasFailedPart(failedParts, "topCouriers");
    return (
      <>
        <KpiRow count={4} label={t("v2Dashboard.kpi.courierLabel", { period: periodText })}>
          <div data-testid="courier-stats-grid" className="contents">
            <StatCard
              label={t("cards.total_orders")}
              icon={Package}
              loading={loading}
              value={stat ? count(stat.totalOrders) : undefined}
              unit={t("unit.orders")}
              {...deltaProps(delta(stat?.totalOrders, prev?.totalOrders))}
              goodWhen="none"
            />
            <StatCard
              label={t("cards.sold")}
              icon={CircleCheck}
              loading={loading}
              value={stat ? count(stat.soldOrders) : undefined}
              unit={t("unit.orders")}
              {...deltaProps(delta(stat?.soldOrders, prev?.soldOrders))}
            />
            <StatCard
              label={t("cards.cancelled")}
              icon={CircleX}
              loading={loading}
              value={stat ? count(stat.canceledOrders) : undefined}
              unit={t("unit.orders")}
              {...deltaProps(delta(stat?.canceledOrders, prev?.canceledOrders))}
              goodWhen="down"
            />
            <StatCard
              label={t("cards.courier_profit")}
              icon={Wallet}
              loading={loading}
              value={stat ? formatMoneyLocalized(stat.profit, { language, withCurrency: false }) : undefined}
              unit={CURRENCY_LABEL[resolveMoneyLanguage(language)]}
              valueTone={stat && stat.profit < 0 ? "danger" : undefined}
              {...deltaProps(delta(stat?.profit, prev?.profit))}
            />
          </div>
        </KpiRow>
        {stat ? (
          <CardRow>
            <CourierPlanCard
              title={period.kind === "today" ? t("v2Dashboard.courier.planToday") : t("v2Dashboard.courier.planPeriod")}
              total={stat.totalOrders}
              sold={stat.soldOrders}
              cancelled={stat.canceledOrders}
            />
            <SuccessRateCard
              rate={stat.successRate}
              sold={stat.soldOrders}
              cancelled={stat.canceledOrders}
              description={t("v2Dashboard.success.subTotal", { period: periodText })}
              gaugeLabel={t("v2Dashboard.success.gaugeTotal")}
              previous={prev && prev.totalOrders > 0 ? { rate: prev.successRate, label: prevName } : null}
            />
            <CourierCashCard />
          </CardRow>
        ) : null}
        {courierRankingFailed ? partError(t("v2Dashboard.top.couriers"), "courier-ranking-failed") : null}
        {!courierRankingFailed && topCouriers.length > 0 ? (
          <TopRankCard
            data-testid="courier-ranking"
            title={t("v2Dashboard.top.couriers")}
            description={t("v2Dashboard.top.courierSub", {
              scope: branchName ? `${branchName} · ` : "",
              period: periodText.toLocaleLowerCase(),
            })}
            icon={Trophy}
            items={courierItems}
            expandable
            empty={null}
            footer={
              myRank ? (
                <p className="m-0 flex w-full flex-wrap items-center justify-between gap-2 text-[13px] text-text-muted">
                  <span>{t("v2Dashboard.top.yourPlace")}</span>
                  <span className="text-text">
                    <span className="font-bold">{t("v2Dashboard.top.place", { rank: myRank })}</span>
                    {gap != null && myRank > 1
                      ? ` · ${t("v2Dashboard.top.gapToNext", {
                          rank: myRank - 1,
                          gap: t("v2Dashboard.pp", { value: formatNumberLocalized(gap, { language, fractionDigits: 1 }) }),
                        })}`
                      : null}
                  </span>
                </p>
              ) : undefined
            }
            note={isLowDataRanking(courierRows(topCouriers), meta) || topCouriers.length < 5 ? t("v2Dashboard.top.limited") : undefined}
          />
        ) : null}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <DashboardHeader
        description={description}
        fromDate={fromDate}
        toDate={toDate}
        onChange={applyRange}
        preset={preset}
        onClear={clearRange}
        showYear={!isCourier}
        rangePlaceholder={isCourier ? t("v2Dashboard.header.rangeCourier") : undefined}
        effectiveRange={getEffectiveAllTimeRange(fromDate, toDate, data?.data?.appliedRange)}
      />
      {/* KI-2 (ega javobi KI-S3): «Ilovani o'rnatish» — faqat kuryer bosh sahifasida, bir marta (yopiladi, shu
          qurilmada eslab qolinadi). Maketda sarlavha va davr filtri orasida; `DashboardHeader` umumiy widget —
          tegilmaydi, shuning uchun karta sarlavha blokidan keyin (telefonda davr filtri ostida). */}
      {isCourier ? <InstallAppCard placement="dashboard" /> : null}
      {renderCourier()}
      {renderStats()}
      {widgets.financial && isAnalyticsAdmin ? (
        <FinancialAnalysis
          // «Barchasi» ↔ oraliq: davr tanlovi qaytadan (barcha davrda sukut — oylik), solishtirish holati saqlanadi.
          key={isAllTime ? "all" : "range"}
          startDate={hasDateFilter ? fromDate : ""}
          endDate={hasDateFilter ? toDate : ""}
          allTime={isAllTime}
          analyticsScope={analyticsScope}
          // NIFAnCvf: yuqoridagi KPI va kartalar yuklangach — aks holda plot skeletlar ostida ekranga tushadi.
          layoutReady={!isLoading && !kpiLoading}
        />
      ) : null}
      {renderRankings()}
      {widgets.region && canShowCompanyBlocks ? (
        <DeferredMount minHeight={560}>
          <RegionOverviewCard
            startDate={hasDateFilter ? fromDate : ""}
            endDate={hasDateFilter ? toDate : ""}
            periodText={periodText.toLocaleLowerCase()}
            periodLabel={periodText}
            variant={isRegistrator ? "registrator" : "full"}
          />
        </DeferredMount>
      ) : null}
    </div>
  );
};

export default memo(DashboardPage);
