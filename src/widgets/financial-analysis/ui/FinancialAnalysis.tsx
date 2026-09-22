import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Wallet,
  Store,
  Building2,
  Scale,
  BarChart2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import {
  useDashboard,
  type RevenueParams,
  type RevenuePoint,
} from "../../../entities/dashboard";
import {
  formatCompactMoney,
  formatNumber,
  formatPercent,
  toneAccent,
  toneSoftBg,
  type Tone,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import MetricCard from "../../../shared/ui/MetricCard";
import { getPreviousPeriodRange, getTodayRange } from "../../../shared/lib/dateRange";
import {
  readStoredDashboardComparison,
  writeStoredDashboardComparison,
} from "../../../shared/lib/preferencesStorage";
import { calculatePercentChange } from "../lib/periodComparison";

/**
 * FinancialAnalysis — moliyaviy tahlil bo'limi.
 *
 * Eski versiyada bu yerda DashboardStatistics bilan TAKRORLANADIGAN kartalar
 * bor edi (bugungi daromad/buyurtma, haftalik daromad, davr statistikasi).
 * Ular olib tashlandi. Endi bu bo'lim FAQAT noyob ma'lumotni ko'rsatadi:
 *   1) Kassa balansi holati (Pochta / marketlar / kuryerlar / joriy holat),
 *   2) Daromad trendi grafigi.
 */

type ChartType = "Area" | "Bar" | "Combo";
export type RevenuePeriod = "daily" | "weekly" | "monthly" | "yearly";

const CHART_TYPES: ChartType[] = ["Area", "Bar", "Combo"];
const PERIODS: RevenuePeriod[] = ["daily", "weekly", "monthly", "yearly"];

const MAIN_COLOR = "var(--color-main)";
const GREEN_COLOR = "var(--color-success)";
const PREVIOUS_COLOR = "var(--color-dashboard-chart-axis)";

const AXIS_PROPS = {
  tick: { fill: "var(--color-dashboard-chart-axis)", fontSize: 12, fontWeight: 600 },
  axisLine: false as const,
  tickLine: false as const,
};

const GRID_PROPS = {
  stroke: "var(--color-dashboard-chart-grid)",
  strokeDasharray: "4 4",
  vertical: false,
};

const formatCurrency = (value: number) => value.toLocaleString("uz-UZ");

// ─── CustomTooltip ────────────────────────────────────────────────────────────

interface RevenueTooltipProps {
  active?: boolean;
  payload?: Array<{
    color?: string;
    name?: string;
    value?: number | string;
  }>;
  label?: string | number;
}

export const CustomTooltip = ({ active, payload, label }: RevenueTooltipProps) => {
  const { t } = useTranslation("dashboard");
  if (!active || !payload?.length) return null;
  return (
    <div className="el-card-soft rounded-xl px-3 py-2 text-[11px]">
      <p className="mb-1 font-semibold" style={{ color: TEXT.strong }}>
        {label}
      </p>
      {payload.map((entry, i) => {
        const isMissing = entry.value === null || entry.value === undefined;
        return (
          <p key={i} className="font-bold" style={{ color: entry.color }}>
            {entry.name}: {isMissing ? "—" : t("currency_value", { value: formatCurrency(Number(entry.value)) })}
          </p>
        );
      })}
    </div>
  );
};

// ─── Chart Variants ───────────────────────────────────────────────────────────

interface ChartPoint {
  date: string;
  revenue: number;
  previousRevenue?: number | null;
}

interface ChartVariantProps {
  data: ChartPoint[];
  showPrevious: boolean;
  currentLabel: string;
  previousLabel: string;
}

const PreviousLine = ({ name }: { name: string }) => (
  <Line
    type="monotone"
    dataKey="previousRevenue"
    name={name}
    stroke={PREVIOUS_COLOR}
    strokeOpacity={0.55}
    strokeDasharray="5 5"
    strokeWidth={2}
    dot={false}
    connectNulls={false}
    isAnimationActive={false}
  />
);

const AreaVariant = ({ data, showPrevious, currentLabel, previousLabel }: ChartVariantProps) => (
  <ComposedChart data={data}>
    <defs>
      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={MAIN_COLOR} stopOpacity={0.3} />
        <stop offset="100%" stopColor={MAIN_COLOR} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCompactMoney} {...AXIS_PROPS} width={54} />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="revenue"
      name={currentLabel}
      stroke={MAIN_COLOR}
      strokeWidth={2}
      fill="url(#revenueGrad)"
      dot={false}
      activeDot={{ r: 5, fill: MAIN_COLOR, stroke: "var(--color-primary)", strokeWidth: 2 }}
    />
    {showPrevious && <PreviousLine name={previousLabel} />}
  </ComposedChart>
);

const BarVariant = ({ data, showPrevious, currentLabel, previousLabel }: ChartVariantProps) => (
  <ComposedChart data={data} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCompactMoney} {...AXIS_PROPS} width={54} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" name={currentLabel} fill={MAIN_COLOR} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
    {showPrevious && <PreviousLine name={previousLabel} />}
  </ComposedChart>
);

const ComboVariant = ({ data, showPrevious, currentLabel, previousLabel }: ChartVariantProps) => (
  <ComposedChart data={data} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCompactMoney} {...AXIS_PROPS} width={54} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" name={currentLabel} fill={MAIN_COLOR} fillOpacity={0.35} radius={[3, 3, 0, 0]} />
    <Line
      type="monotone"
      dataKey="revenue"
      name={currentLabel}
      stroke={GREEN_COLOR}
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 4, fill: GREEN_COLOR }}
    />
    {showPrevious && <PreviousLine name={previousLabel} />}
  </ComposedChart>
);

// ─── RevenueChart ─────────────────────────────────────────────────────────────

const RevenueChart = memo(({ data, showPrevious, previousLabel, previousLoading }: { data: ChartPoint[]; showPrevious: boolean; previousLabel: string; previousLoading?: boolean }) => {
  const { t } = useTranslation("dashboard");
  const [activeType, setActiveType] = useState<ChartType>("Area");

  const chart = useCallback(() => {
    const props = { data, showPrevious, currentLabel: t("comparison.current"), previousLabel };
    if (activeType === "Bar") return <BarVariant {...props} />;
    if (activeType === "Combo") return <ComboVariant {...props} />;
    return <AreaVariant {...props} />;
  }, [activeType, data, previousLabel, showPrevious, t]);

  return (
    <div className="el-card flex h-full flex-col rounded-2xl p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>
          {t("chart.title")}
        </h3>
        <div className="el-segmented">
          {CHART_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`el-segmented-button px-3.5 py-1 text-xs font-semibold ${
                activeType === type ? "el-segmented-button-active" : ""
              }`}
            >
              {t(`chart.types.${type.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {chart()}
      </ResponsiveContainer>

      {showPrevious && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs" style={{ color: TEXT.soft }}>
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: MAIN_COLOR }} />{t("comparison.current")}</span>
          <span><span className="mr-1 inline-block h-0.5 w-4 align-middle opacity-50" style={{ background: PREVIOUS_COLOR }} />{previousLabel}</span>
        </div>
      )}

      {/* Solishtirish yoqilgan-u, oldingi davr chizig'i hali ko'rinmasa (yuklanmoqda) —
          "ma'lumot yo'q" bilan chalkashtirmaslik uchun alohida holat ko'rsatiladi. */}
      {!showPrevious && previousLoading && (
        <p className="mt-2 text-center text-xs" style={{ color: TEXT.soft }}>
          {t("comparison.loading")}
        </p>
      )}

      <p className="mt-3 text-center text-[13px] tracking-[0.2px]" style={{ color: TEXT.strong }}>
        {t("chart.description")}
      </p>
    </div>
  );
});

RevenueChart.displayName = "RevenueChart";

// ─── FinancialAnalysis ────────────────────────────────────────────────────────

export interface FinancialAnalysisProps {
  startDate?: string;
  endDate?: string;
  analyticsScope?: string;
  isAllTime?: boolean;
}

const FinancialAnalysis = memo(({
  startDate,
  endDate,
  analyticsScope,
  isAllTime = false,
}: FinancialAnalysisProps) => {
  const { t } = useTranslation("dashboard");
  const { getRevenue } = useDashboard();
  const [period, setPeriod] = useState<RevenuePeriod>("daily");
  const [comparisonEnabled, setComparisonEnabled] = useState(
    () => readStoredDashboardComparison() ?? true,
  );

  useEffect(() => {
    if (isAllTime) setPeriod("yearly");
  }, [isAllTime]);

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
    () => ({
      period,
      start_day: previousRange?.from,
      end_day: previousRange?.to,
    }),
    [period, previousRange],
  );

  const { data, isLoading, isError, refetch } = getRevenue(
    revenueParams,
    true,
    analyticsScope,
  );
  const revenuePayload = data?.data;
  const {
    data: previousData,
    isLoading: previousLoading,
    isError: previousError,
    refetch: refetchPrevious,
  } = getRevenue(previousParams, comparisonEnabled && Boolean(previousRange), analyticsScope);
  const previousPayload = previousData?.data;
  // Faqat so'rov haqiqatan bajarilayotganda "yuklanmoqda" — o'chirilgan holatda
  // react-query oldingi (stale) isLoading qiymatini saqlab qolishi mumkin.
  const isPreviousLoading = comparisonEnabled && Boolean(previousRange) && previousLoading;

  const toggleComparison = () => {
    const next = !comparisonEnabled;
    setComparisonEnabled(next);
    writeStoredDashboardComparison(next);
  };

  // Daromad grafigi nuqtalari
  const chartData = useMemo(() => {
    const rawRevenuePoints = Object.values(revenuePayload ?? {}).filter(
      (item): item is RevenuePoint =>
        typeof item === "object" && item !== null && "label" in item && "revenue" in item,
    );

    return revenuePayload?.chart?.labels?.length && revenuePayload?.chart?.values?.length
      ? revenuePayload.chart.labels.map((label, index) => ({
          date: label,
          revenue: Number(revenuePayload.chart?.values?.[index] ?? 0),
        }))
      : rawRevenuePoints.map((item) => ({
          date: item.label,
          revenue: Number(item.revenue ?? 0),
        }));
  }, [revenuePayload]);

  const currentSummary = revenuePayload?.summary;
  const previousSummary = previousPayload?.summary;
  const previousHasData = Boolean(previousSummary && previousSummary.totalOrders > 0);
  const previousValues = previousPayload?.chart?.values;
  // Nuqtalar joriy va oldingi davr o'rtasida FAQAT indeks bo'yicha moslashtiriladi (sana
  // bo'yicha emas), shu sababli ikkala massiv bir xil uzunlikda bo'lgandagina ishonchli.
  // getPreviousPeriodRange kunlar sonini teng qilib beradi, lekin backend `weekly`/
  // `monthly`/`yearly` davrlar uchun turli sondagi bucket qaytarishi mumkin — bunda
  // moslikni noto'g'ri taqdim etmaslik uchun oldingi chiziqni butunlay o'chiramiz.
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

  const comparisonChartData: ChartPoint[] = useMemo(
    () => chartData.map((point, index) => ({
      ...point,
      previousRevenue: showPreviousLine ? (previousValues?.[index] ?? null) : null,
    })),
    [chartData, previousValues, showPreviousLine],
  );
  const previousLabel = previousRange
    ? `${t("comparison.previous")} (${previousRange.from} – ${previousRange.to})`
    : t("comparison.previous");

  const comparisonMetrics = [
    {
      title: t("comparison.total_revenue"),
      value: currentSummary?.totalRevenue ?? 0,
      previous: previousHasData ? previousSummary?.totalRevenue : undefined,
      icon: <Wallet size={20} />,
      suffix: t("currency_sum"),
      tone: "brand" as Tone,
    },
    {
      title: t("comparison.total_orders"),
      value: currentSummary?.totalOrders ?? 0,
      previous: previousHasData ? previousSummary?.totalOrders : undefined,
      icon: <Receipt size={20} />,
      suffix: t("unit.orders"),
      tone: "info" as Tone,
    },
    {
      title: t("comparison.avg_revenue"),
      value: currentSummary?.avgRevenue ?? 0,
      previous: previousHasData ? previousSummary?.avgRevenue : undefined,
      icon: <TrendingUp size={20} />,
      suffix: t("currency_sum"),
      tone: "success" as Tone,
    },
  ];

  // Noyob moliyaviy balans ma'lumotlari (kassa holati) — DashboardStatistics'da YO'Q
  const finance = revenuePayload?.finance;
  const hasFinance = Boolean(finance);
  const mainBalance = Number(finance?.main?.balance ?? 0);
  const marketsBalance = Number(finance?.markets?.marketsTotalBalans ?? 0);
  const branchesBalance = Number(
    finance?.branches?.branchReceivable ?? finance?.couriers?.couriersTotalBalanse ?? 0,
  );
  const currentSituation = Number(finance?.currentSituation ?? 0);

  const balanceRows: Array<{
    title: string;
    value: number;
    icon: React.ReactNode;
    tone: Tone;
  }> = [
    { title: t("balance.main"), value: mainBalance, icon: <Wallet size={16} />, tone: "brand" },
    { title: t("balance.markets"), value: marketsBalance, icon: <Store size={16} />, tone: "info" },
    { title: t("balance.branches"), value: branchesBalance, icon: <Building2 size={16} />, tone: "warning" },
    {
      title: t("balance.current"),
      value: currentSituation,
      icon: <Scale size={16} />,
      tone: currentSituation < 0 ? "danger" : "success",
    },
  ];

  if (isError) {
    return (
      <QueryErrorState
        description={t("load_error")}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading) {
    return <div className="h-80 animate-pulse rounded-2xl bg-main/10" />;
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} style={{ color: "var(--color-main)" }} />
          <div>
            <h2 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>
              {t("financial_analysis.title")}
            </h2>
            <p className="mt-1 text-xs" style={{ color: TEXT.soft }}>
              {t("financial_analysis.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={comparisonEnabled}
            onClick={toggleComparison}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${comparisonEnabled ? "bg-main text-white" : "el-glass-control text-maindark dark:text-primary"}`}
          >
            {t("comparison.toggle")}
          </button>
          <div className="el-segmented max-w-full flex-wrap">
            {PERIODS.filter((p) => !isAllTime || p === "monthly" || p === "yearly").map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`el-segmented-button px-3.5 py-1.5 text-xs font-semibold ${
                  period === p ? "el-segmented-button-active" : ""
                }`}
              >
                {t(`periods.${p}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {comparisonEnabled && Boolean(previousRange) && previousError && (
        <div className="mb-4">
          <QueryErrorState description={t("comparison.load_error")} onRetry={() => void refetchPrevious()} />
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {comparisonMetrics.map((metric) => {
          const delta = comparisonEnabled
            ? calculatePercentChange(metric.value, metric.previous)
            : null;
          // "Hali yuklanmoqda" holati "ma'lumot yo'q" (—) dan alohida ko'rsatiladi,
          // aks holda foydalanuvchi ikkalasini bir xil deb o'qiydi.
          const badge = !comparisonEnabled
            ? undefined
            : isPreviousLoading
              ? "…"
              : delta === null
                ? "—"
                : `${delta > 0 ? "+" : ""}${formatPercent(delta)}`;
          return (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={formatNumber(metric.value)}
              suffix={metric.suffix}
              icon={metric.icon}
              tone={metric.tone}
              badge={badge}
              badgeUp={isPreviousLoading || delta === null || delta === 0 ? undefined : delta > 0}
              compact
              hint={comparisonEnabled
                ? `${previousLabel}: ${
                    isPreviousLoading
                      ? t("comparison.loading")
                      : metric.previous === undefined
                        ? "—"
                        : `${formatNumber(metric.previous)} ${metric.suffix}`
                  }`
                : undefined}
            />
          );
        })}
      </div>

      {/* Bento: keng daromad grafigi + tor kassa balansi paneli */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={hasFinance ? "lg:col-span-8" : "lg:col-span-12"}>
          <RevenueChart
            data={comparisonChartData}
            showPrevious={showPreviousLine}
            previousLabel={previousLabel}
            previousLoading={isPreviousLoading}
          />
        </div>
        {hasFinance && (
          <div className="lg:col-span-4">
            <FinanceBalancePanel
              title={t("balance.title")}
              rows={balanceRows}
              currency={t("currency_sum")}
            />
          </div>
        )}
      </div>
    </section>
  );
});

// ─── FinanceBalancePanel ──────────────────────────────────────────────────────
// Kassa balanslari — gorizontal mini-bar ko'rinishida (grafiklar xilma-xilligi).

interface FinanceBalancePanelProps {
  title: string;
  currency: string;
  rows: Array<{ title: string; value: number; icon: React.ReactNode; tone: Tone }>;
}

const FinanceBalancePanel = memo(({ title, currency, rows }: FinanceBalancePanelProps) => {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="el-card flex h-full flex-col rounded-2xl p-5">
      <div className="mb-5 flex items-center gap-2">
        <Wallet size={16} style={{ color: "var(--color-main)" }} />
        <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>{title}</h3>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        {rows.map((r) => {
          const accent = toneAccent(r.tone);
          const width = Math.max(6, (Math.abs(r.value) / maxAbs) * 100);
          return (
            <div key={r.title}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: TEXT.strong }}>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-lg"
                    style={{ background: toneSoftBg(r.tone, 16), color: accent }}
                  >
                    {r.icon}
                  </span>
                  {r.title}
                </span>
                <span className="text-[13px] font-bold text-maindark dark:text-primary">
                  {formatCompactMoney(r.value)}
                  <span className="ml-1 text-[10px] font-semibold uppercase" style={{ color: TEXT.soft }}>
                    {currency}
                  </span>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: toneSoftBg(r.tone, 14) }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${width}%`, background: accent }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

FinanceBalancePanel.displayName = "FinanceBalancePanel";

FinancialAnalysis.displayName = "FinancialAnalysis";

export default FinancialAnalysis;
