// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main
import { lazy, memo, Suspense, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { useDashboard, type RevenueParams, type RevenuePoint, type RevenueResponse } from "../../../entities/dashboard";
import { formatShortRange, rangeDays } from "../../../entities/dashboard/lib/period";
import { cx } from "../../../shared/lib/cx";
import { getPreviousPeriodRange, getTodayRange } from "../../../shared/lib/dateRange";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
} from "../../../shared/lib/formatMoney";
import {
  readStoredDashboardComparison,
  writeStoredDashboardComparison,
} from "../../../shared/lib/preferencesStorage";
import DeferredMount from "../../../shared/ui/DeferredMount";
import { ChartLegend, DeltaChip, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Pressable,
  QueryBoundary,
  SegmentedControl,
  Skeleton,
  SkeletonChart,
} from "../../../shared/ui/primitives";
import { calculatePercentChange } from "../lib/periodComparison";
import CashBalanceCard from "./CashBalanceCard";
import type { TrendPoint } from "./FinancialTrendPlot";

/**
 * recharts FAQAT shu plotda va u alohida chunk: plot maydoni ekranga kirgandagina yuklanadi
 * (`DeferredMount rootMargin="0px"`). 1440×900 da plot birinchi ekrandan pastda — dashboard birinchi
 * ochilishida recharts yuklanmaydi (§1.9 byudjeti, `tests/e2e/dashboard-bundle.preview.spec.ts`). Kuzatish
 * sahifa ma'lumoti kelgach boshlanadi (`layoutReady`): daromad dashboarddan oldin kelsa, yuqoridagi past
 * skeletlar ostida plot bir lahza ekranga tushib, recharts'ni yuklab yuborardi (NIFAnCvf, prod 529 KB).
 */
const FinancialTrendPlot = lazy(() => import("./FinancialTrendPlot"));

export type RevenuePeriod = "daily" | "weekly" | "monthly" | "yearly";
const PERIODS: readonly RevenuePeriod[] = ["daily", "weekly", "monthly", "yearly"];
const PLOT_HEIGHT = { desktop: 300, phone: 180 } as const;

export interface FinancialAnalysisProps {
  startDate?: string;
  endDate?: string;
  analyticsScope?: string;
  /** Sahifaning yuqoridagi bloklari yuklanib, joylashuv barqaror (sukut `true`) — plot kuzatuvi shundan keyin. */
  layoutReady?: boolean;
}

/**
 * Joriy javobdan grafik nuqtalari — faqat `chart.labels/values` (2Fj7iw1k: backend ularni doim to'ldiradi; eski
 * zaxira yo'li — javobdagi raqamli `"0"`, `"1"` kalitlaridan `RevenuePoint` yig'ish — olib tashlandi). Buyurtmalar
 * soni — `data[]` bo'laklaridan (`ordersCount`), `label` bo'yicha; topilmasa `null` («—», 0 emas).
 */
const toChartData = (payload: RevenueResponse["data"] | undefined) => {
  const labels = payload?.chart?.labels ?? [];
  const values = payload?.chart?.values ?? [];
  if (!labels.length || !values.length) return [];
  const buckets = Array.isArray(payload?.data) ? (payload.data as Partial<RevenuePoint>[]) : [];
  const ordersByLabel = new Map(
    buckets
      .filter((bucket) => typeof bucket?.label === "string" && Number.isFinite(Number(bucket.ordersCount)))
      .map((bucket) => [bucket.label as string, Number(bucket.ordersCount)]),
  );
  return labels.map((label, index) => ({
    date: label,
    revenue: Number(values[index] ?? 0),
    orders: ordersByLabel.get(label) ?? null,
  }));
};

/**
 * Qisman nosozlik (VkwhHqvW): revenue javobida shu bo'laklardan biri olinmadimi (`degraded` + `failedParts`;
 * qaysi bo'lak aytilmasa — hammasi olinmagan hisoblanadi).
 */
const isPartFailed = (payload: RevenueResponse["data"] | undefined, ...parts: string[]) => {
  if (!payload?.degraded) return false;
  const failed = payload.failedParts ?? [];
  return failed.length === 0 || failed.some((part) => parts.includes(part));
};

/** «Solishtirish» almashtirgichi (`.el-switch`) — telefonda to'liq enli qator. */
const ComparisonSwitch = ({ checked, onToggle, label, ariaLabel }: { checked: boolean; onToggle: () => void; label: string; ariaLabel: string }) => (
  <Pressable
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onToggle}
    className="ml-auto inline-flex min-h-9 items-center gap-2.5 rounded-lg text-[13px] font-semibold text-text max-md:ml-0 max-md:min-h-11 max-md:w-full max-md:justify-between"
  >
    {label}
    <span
      aria-hidden="true"
      className={cx(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 motion-reduce:transition-none",
        checked ? "bg-action" : "bg-border-strong",
      )}
    >
      <span
        className={cx(
          "block size-5 rounded-full bg-surface transition-transform duration-150 motion-reduce:transition-none",
          checked && "translate-x-4",
        )}
      />
    </span>
  </Pressable>
);

/**
 * «MOLIYAVIY TAHLIL» (2/3) + «KASSA BALANSI» (1/3) — faqat SA/admin, «Barchasi»dan tashqari davrda.
 *
 * Saqlanadigan xulq (eski `FinancialAnalysis.tsx:278-319`): davr holati (Kunlik … Yillik), oldingi teng
 * davr `getPreviousPeriodRange`, solishtirish so'rovi faqat yoqilganda, holat `preferencesStorage` da,
 * nuqtalar soni teng bo'lmasa oldingi chiziq yashiriladi, foiz o'zgarishi `calculatePercentChange`.
 * Ega savoli 4 sukuti: qator — daromad (`SUM(total_price)`), sarlavha «Moliyaviy tahlil».
 */
const FinancialAnalysis = ({ startDate, endDate, analyticsScope, layoutReady = true }: FinancialAnalysisProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const { getRevenue } = useDashboard();
  const [period, setPeriod] = useState<RevenuePeriod>("daily");
  const [view, setView] = useState<ChartView>("chart");
  const [comparisonEnabled, setComparisonEnabled] = useState(() => readStoredDashboardComparison() ?? true);

  const todayRange = getTodayRange();
  const effectiveStart = startDate || todayRange.from;
  const effectiveEnd = endDate || todayRange.to;
  const previousRange = useMemo(
    () => getPreviousPeriodRange({ from: effectiveStart, to: effectiveEnd }),
    [effectiveStart, effectiveEnd],
  );
  const revenueParams = useMemo<RevenueParams>(
    () => ({ period, start_day: effectiveStart, end_day: effectiveEnd }),
    [effectiveEnd, effectiveStart, period],
  );
  const previousParams = useMemo<RevenueParams>(
    () => ({ period, start_day: previousRange?.from, end_day: previousRange?.to }),
    [period, previousRange],
  );

  const revenueQuery = getRevenue(revenueParams, true, analyticsScope);
  const previousQuery = getRevenue(previousParams, comparisonEnabled && Boolean(previousRange), analyticsScope);
  const revenuePayload = revenueQuery.data?.data;
  const previousPayload = previousQuery.data?.data;
  // Qisman nosozlik (VkwhHqvW): olinmagan bo'lak 0 lar bilan emas, o'z kartasi joyida xato + «Qayta urinish».
  // `summary`/`chart` — «Moliyaviy tahlil», `finance` — «Kassa balansi»; qaysi bo'lak aytilmasa — ikkalasi.
  const trendFailed = useMemo(() => isPartFailed(revenuePayload, "summary", "chart"), [revenuePayload]);
  const cashFailed = useMemo(() => isPartFailed(revenuePayload, "finance"), [revenuePayload]);
  // Olinmagan bo'lak — `QueryBoundary` uchun xato holati (ma'lumotsiz), «Qayta urinish» — o'sha so'rov.
  const failedRevenue = {
    data: undefined,
    isError: true,
    isLoading: false,
    isFetching: revenueQuery.isFetching,
    refetch: revenueQuery.refetch,
  };
  const trendQuery = trendFailed ? failedRevenue : revenueQuery;
  const cashQuery = cashFailed ? failedRevenue : revenueQuery;
  // Faqat so'rov haqiqatan bajarilayotganda «yuklanmoqda» (o'chirilganda eski isLoading qolishi mumkin).
  const isPreviousLoading = comparisonEnabled && Boolean(previousRange) && previousQuery.isLoading;

  const toggleComparison = () => {
    const next = !comparisonEnabled;
    setComparisonEnabled(next);
    writeStoredDashboardComparison(next);
  };

  const chartData = useMemo(() => toChartData(revenuePayload), [revenuePayload]);
  const currentSummary = revenuePayload?.summary;
  const previousSummary = previousPayload?.summary;
  // Oldingi davrning daromad bo'lagi olinmagan bo'lsa — 0 bilan solishtirilmaydi (delta va chiziq yo'q).
  const previousFailed = useMemo(() => isPartFailed(previousPayload, "summary", "chart"), [previousPayload]);
  const previousHasData = !previousFailed && Boolean(previousSummary && previousSummary.totalOrders > 0);
  const previousValues = previousPayload?.chart?.values;
  const previousLabels = previousPayload?.chart?.labels;
  // Nuqtalar faqat indeks bo'yicha moslashtiriladi — uzunlik teng bo'lmasa oldingi chiziq yashiriladi.
  const previousLengthMatches = Boolean(previousValues?.length) && previousValues!.length === chartData.length;
  const previousLengthMismatch = Boolean(
    comparisonEnabled && previousHasData && previousValues?.length && !previousLengthMatches,
  );
  const showPreviousLine = comparisonEnabled && previousHasData && previousLengthMatches;

  useEffect(() => {
    if (previousLengthMismatch) {
      console.warn(
        `[FinancialAnalysis] Oldingi davr grafigi ${previousValues?.length} nuqta, joriy davr ${chartData.length} nuqta qaytardi — moslik ishonchli emas, chiziq yashirildi.`,
      );
    }
  }, [previousLengthMismatch, previousValues?.length, chartData.length]);

  const points: TrendPoint[] = useMemo(
    () =>
      chartData.map((point, index) => ({
        label: point.date,
        current: point.revenue,
        orders: point.orders,
        previous: showPreviousLine ? (previousValues?.[index] ?? null) : null,
        previousLabel: showPreviousLine && previousLabels?.[index]
          ? t("v2Dashboard.finance.previousPoint", { label: previousLabels[index] })
          : undefined,
      })),
    [chartData, previousLabels, previousValues, showPreviousLine, t],
  );

  const currentRangeText = formatShortRange({ from: effectiveStart, to: effectiveEnd });
  const previousRangeText = previousRange ? formatShortRange(previousRange) : "";
  const days = rangeDays({ from: effectiveStart, to: effectiveEnd });

  const metrics = [
    {
      key: "revenue",
      label: t("v2Dashboard.finance.revenueDays", { count: days }),
      value: currentSummary?.totalRevenue ?? 0,
      previous: previousHasData ? previousSummary?.totalRevenue : undefined,
      format: (value: number) => formatCompactMoneyLocalized(value, { language }),
      formatPrevious: (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false }),
    },
    {
      key: "orders",
      label: t("v2Dashboard.finance.orders"),
      value: currentSummary?.totalOrders ?? 0,
      previous: previousHasData ? previousSummary?.totalOrders : undefined,
      format: (value: number) => t("v2Charts.countTa", { value: formatNumberLocalized(value, { language }) }),
      formatPrevious: (value: number) => t("v2Charts.countTa", { value: formatNumberLocalized(value, { language }) }),
    },
    {
      key: "average",
      label: t(`v2Dashboard.finance.average.${period}`),
      value: currentSummary?.avgRevenue ?? 0,
      previous: previousHasData ? previousSummary?.avgRevenue : undefined,
      format: (value: number) => formatCompactMoneyLocalized(value, { language }),
      formatPrevious: (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false }),
    },
  ];

  const controls = (
    <div className="flex flex-wrap items-center gap-2 max-md:w-full">
      <SegmentedControl<RevenuePeriod>
        ariaLabel={t("v2Dashboard.finance.periodLabel")}
        value={period}
        onValueChange={setPeriod}
        options={PERIODS.map((value) => ({ value, label: t(`periods.${value}`) }))}
      />
      <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Dashboard.finance.viewLabel")} />
    </div>
  );

  const previousError = comparisonEnabled && Boolean(previousRange) && previousQuery.isError;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-3 max-md:gap-3">
      <Card
        divided={false}
        className="lg:col-span-2"
        title={t("v2Dashboard.finance.title")}
        description={t("v2Dashboard.finance.subtitle")}
        actions={controls}
        bodyClassName="flex flex-col gap-4"
      >
        <QueryBoundary query={trendQuery} skeleton="chart" size="chart" isEmpty={() => false}>
          {(_data, { isRefetching }) => (
            <div className={cx("flex flex-col gap-4 transition-opacity", isRefetching && "opacity-45")}>
              <dl className="m-0 grid grid-cols-3 gap-4 max-md:grid-cols-1 max-md:gap-0">
                {metrics.map((metric) => {
                  const delta = comparisonEnabled ? calculatePercentChange(metric.value, metric.previous) : null;
                  return (
                    <div
                      key={metric.key}
                      className="flex min-w-0 flex-col gap-1 max-md:flex-row max-md:items-center max-md:justify-between max-md:gap-3 max-md:border-t max-md:border-border max-md:py-2 max-md:first:border-t-0"
                    >
                      <dt className="text-xs text-text-muted max-md:text-[13px]">{metric.label}</dt>
                      <dd className="m-0 flex min-w-0 flex-col gap-1 max-md:flex-row max-md:items-center max-md:gap-2">
                        <span className="whitespace-nowrap text-xl leading-7 font-bold text-text proportional-nums max-md:text-sm max-md:leading-5">
                          {metric.format(metric.value)}
                        </span>
                        {comparisonEnabled ? (
                          <span className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                            {isPreviousLoading ? (
                              <Skeleton shape="line" width={88} />
                            ) : delta != null ? (
                              <DeltaChip value={delta} />
                            ) : null}
                            {!isPreviousLoading && metric.previous != null ? (
                              <span className="max-md:hidden">
                                {t("v2Dashboard.finance.previousValue", { value: metric.formatPrevious(metric.previous) })}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {previousError ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg">
                  <span className="min-w-0 flex-1">{t("comparison.load_error")}</span>
                  <Button variant="secondary" size="sm" onClick={() => void previousQuery.refetch()}>
                    {t("v2Dashboard.retry")}
                  </Button>
                </div>
              ) : null}

              {points.length === 0 ? (
                <EmptyState size="chart" title={t("v2Dashboard.finance.empty")} />
              ) : view === "chart" ? (
                <figure
                  className="m-0 min-w-0"
                  aria-label={t("v2Dashboard.finance.chartAria", { range: currentRangeText })}
                >
                  <DeferredMount
                    minHeight={PLOT_HEIGHT.desktop}
                    rootMargin="0px"
                    ready={layoutReady}
                    className="h-[300px] max-md:h-[180px]"
                  >
                    <Suspense fallback={<SkeletonChart className="h-full" />}>
                      <PlotSizer
                        points={points}
                        showPrevious={showPreviousLine}
                        currentName={t("v2Dashboard.finance.current")}
                        previousName={t("v2Dashboard.finance.previous")}
                      />
                    </Suspense>
                  </DeferredMount>
                </figure>
              ) : (
                <DataTable
                  rows={points}
                  getRowKey={(row, index) => `${row.label}-${index}`}
                  label={t("v2Dashboard.finance.title")}
                  density="compact"
                  // Telefon (< 768): 4 ustun sig'maydi — har nuqta karta (gorizontal skroll yo'q).
                  renderCard={(row) => (
                    <div className="flex items-start gap-3 px-4 py-3 text-sm text-text">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex justify-between gap-2">
                          <span className="min-w-0 font-semibold">{row.label}</span>
                          <span className="whitespace-nowrap font-semibold tabular-nums">
                            {formatMoneyLocalized(row.current, { language })}
                          </span>
                        </span>
                        <span className="text-[13px] text-text-muted">
                          {row.orders == null
                            ? "—"
                            : t("v2Charts.countTa", { value: formatNumberLocalized(row.orders, { language }) })}
                          {showPreviousLine && row.previous != null ? (
                            <>
                              {" · "}
                              <span className="whitespace-nowrap">
                                {t("v2Dashboard.finance.previous")}: {formatMoneyLocalized(row.previous, { language })}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </div>
                  )}
                  columns={[
                    { id: "label", header: t("v2Dashboard.finance.tableDate"), cell: (row) => row.label },
                    {
                      id: "current",
                      header: t("v2Dashboard.finance.current"),
                      align: "end",
                      cell: (row) => formatMoneyLocalized(row.current, { language }),
                    },
                    ...(showPreviousLine
                      ? [
                          {
                            id: "previous",
                            header: t("v2Dashboard.finance.previous"),
                            align: "end" as const,
                            cell: (row: TrendPoint) => (row.previous == null ? "—" : formatMoneyLocalized(row.previous, { language })),
                          },
                        ]
                      : []),
                    {
                      // Buyurtmalar soni — «Jadval»da (maketda grafikda yo'q; davr yakunida jami — yuqorida).
                      id: "orders",
                      header: t("v2Dashboard.finance.orders"),
                      align: "end" as const,
                      cell: (row: TrendPoint) =>
                        row.orders == null
                          ? "—"
                          : t("v2Charts.countTa", { value: formatNumberLocalized(row.orders, { language }) }),
                    },
                  ]}
                />
              )}
            </div>
          )}
        </QueryBoundary>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
          <ChartLegend
            items={[
              {
                key: "current",
                tone: "action",
                line: true,
                keyClassName: "bg-chart-1",
                label: t("v2Dashboard.finance.currentRange", { range: currentRangeText }),
              },
              ...(comparisonEnabled && previousRange
                ? [
                    {
                      key: "previous",
                      tone: "neutral" as const,
                      line: true,
                      keyClassName: "bg-chart-muted",
                      label: t("v2Dashboard.finance.previousRange", { range: previousRangeText }),
                    },
                  ]
                : []),
            ]}
          />
          <ComparisonSwitch
            checked={comparisonEnabled}
            onToggle={toggleComparison}
            label={t("comparison.toggle")}
            ariaLabel={t("v2Dashboard.finance.compareAria")}
          />
        </div>
      </Card>
      <CashBalanceCard query={cashQuery} />
    </div>
  );
};

/** Plot balandligi: desktop 300, telefon 180 (o'lcham bir marta, ochilganda). */
const PlotSizer = (props: Omit<ComponentProps<typeof FinancialTrendPlot>, "height">) => {
  const phone = typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches === true;
  return <FinancialTrendPlot {...props} height={phone ? PLOT_HEIGHT.phone : PLOT_HEIGHT.desktop} />;
};

export default memo(FinancialAnalysis);
