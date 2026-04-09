import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  BarChart,
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
  DollarSign,
  ShoppingCart,
  BarChart2,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useDashboard, type RevenuePoint } from "../../../entities/dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartType = "Area" | "Bar" | "Combo";
export type RevenuePeriod = "daily" | "weekly" | "monthly" | "yearly";
type ColorVariant = "success" | "info" | "warning" | "error";


interface FinanceCardProps {
  title: string;
  subtitle: string;
  value: string;
  currency?: string;
  valueLabel?: string;
  trend?: string;
  trendValue?: string;
  trendUp?: boolean;
  compareLabel?: string;
  compareValue?: string;
  icon: React.ReactNode;
  variant: ColorVariant;
}

interface PeriodStatItem {
  label: string;
  value: string;
  color: string;
}

const CHART_TYPES: ChartType[] = ["Area", "Bar", "Combo"];
const PERIODS: RevenuePeriod[] = ["daily", "weekly", "monthly", "yearly"];

const VARIANT_COLOR: Record<ColorVariant, string> = {
  info: "var(--color-info)",
  success: "var(--color-success)",
  error: "var(--color-error)",
  warning: "var(--color-warning)",
};

// ─── Chart constants ──────────────────────────────────────────────────────────

const MAIN_COLOR = "#576adb";
const GREEN_COLOR = "#22c55e";

const AXIS_PROPS = {
  tick: { fill: "rgba(244,245,250,0.35)", fontSize: 10 },
  axisLine: false as const,
  tickLine: false as const,
};

const GRID_PROPS = {
  stroke: "rgba(76,87,152,0.25)",
  strokeDasharray: "4 4",
  vertical: false,
};

const formatCurrency = (value: number) => value.toLocaleString("uz-UZ");

// ─── CustomTooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[11px]
        bg-sidebar dark:bg-maindark
        border border-black/[0.07] dark:border-primarydark/50"
    >
      <p className="mb-1 font-semibold text-maindark/50 dark:text-sidebar/50">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: entry.color }}>
          {formatCurrency(Number(entry.value ?? 0))} UZS
        </p>
      ))}
    </div>
  );
};

// ─── Chart Variants ───────────────────────────────────────────────────────────

const AreaVariant = ({ data }: { data: Array<{ date: string; revenue: number }> }) => (
  <AreaChart data={data}>
    <defs>
      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={MAIN_COLOR} stopOpacity={0.3} />
        <stop offset="100%" stopColor={MAIN_COLOR} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="revenue"
      stroke={MAIN_COLOR}
      strokeWidth={2}
      fill="url(#revenueGrad)"
      dot={false}
      activeDot={{ r: 5, fill: MAIN_COLOR, stroke: "var(--color-primary)", strokeWidth: 2 }}
    />
  </AreaChart>
);

const BarVariant = ({ data }: { data: Array<{ date: string; revenue: number }> }) => (
  <BarChart data={data} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" fill={MAIN_COLOR} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
  </BarChart>
);

const ComboVariant = ({ data }: { data: Array<{ date: string; revenue: number }> }) => (
  <ComposedChart data={data} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" fill={MAIN_COLOR} fillOpacity={0.35} radius={[3, 3, 0, 0]} />
    <Line
      type="monotone"
      dataKey="revenue"
      stroke={GREEN_COLOR}
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 4, fill: GREEN_COLOR }}
    />
  </ComposedChart>
);

// ─── FinanceCard ──────────────────────────────────────────────────────────────

const FinanceCard = memo(({
  title, subtitle, value, currency = "UZS",
  valueLabel, trend, trendValue, trendUp = false,
  compareLabel, compareValue, icon, variant,
}: FinanceCardProps) => {
  const accentColor = VARIANT_COLOR[variant];
  const trendColor = trendUp ? "var(--color-success)" : "var(--color-error)";

  return (
    <div
      className="relative flex flex-col rounded-xl overflow-hidden
        bg-sidebar dark:bg-maindark
        border border-black/[0.07] dark:border-primarydark/25"
    >
      <span
        className="absolute top-0 left-0 right-0 h-0.75"
        style={{ background: accentColor }}
      />

      <div className="flex flex-col flex-1 p-4 pt-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: accentColor, color: "var(--color-primary)" }}
            >
              {icon}
            </div>
            <div>
              <p className="text-[13px] font-semibold leading-tight text-maindark dark:text-primary">
                {title}
              </p>
              <p className="text-[11px] leading-tight mt-px text-maindark/45 dark:text-sidebar/45">
                {subtitle}
              </p>
            </div>
          </div>
          <Info
            size={13}
            style={{ color: "var(--color-sidebar)", opacity: 0.3 }}
            className="mt-0.5 shrink-0"
          />
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[24px] font-bold leading-none tracking-tight text-maindark dark:text-primary">
                {value}
              </span>
              {currency && (
                <span className="text-[11px] font-semibold text-maindark/45 dark:text-sidebar/45">
                  {currency}
                </span>
              )}
            </div>
            {valueLabel && (
              <p className="text-[11px] mt-0.5 text-maindark/40 dark:text-sidebar/40">
                {valueLabel}
              </p>
            )}
          </div>

          {trend && (
            <div className="text-right">
              <p
                className="text-[12px] font-bold flex items-center gap-0.5 justify-end"
                style={{ color: trendColor }}
              >
                {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {trend}
              </p>
              {trendValue && (
                <p className="text-[11px] font-semibold mt-px" style={{ color: trendColor }}>
                  {trendValue}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {compareLabel && (
        <div
          className="flex items-center justify-between px-4 py-2.5 text-[11px]
            border-t border-black/[0.07] dark:border-primarydark/20"
        >
          <span className="flex items-center gap-1 text-maindark/45 dark:text-sidebar/45">
            <TrendingDown size={11} />
            {compareLabel}
          </span>
          <span className="font-semibold text-maindark dark:text-primary">
            {compareValue}
          </span>
        </div>
      )}
    </div>
  );
});

FinanceCard.displayName = "FinanceCard";

// ─── PeriodStatsCard ──────────────────────────────────────────────────────────

const PeriodStatsCard = memo(({ totalOrders, sold, profit, period }: {
  totalOrders: number;
  sold: number;
  profit: number;
  period: RevenuePeriod;
}) => {
  const { t } = useTranslation("dashboard");

  const periodStats: PeriodStatItem[] = [
    {
      label: t("period_stats.total_revenue"),
      value: t("currency_value", { value: profit.toLocaleString() }),
      color: "var(--color-success)",
    },
    {
      label: t("period_stats.orders"),
      value: String(totalOrders),
      color: "var(--color-info)",
    },
    {
      label: t("period_stats.sold"),
      value: String(sold),
      color: "var(--color-main)",
    },
  ];

  return (
    <div
      className="relative flex flex-col rounded-xl overflow-hidden
        bg-sidebar dark:bg-maindark
        border border-black/[0.07] dark:border-primarydark/25"
    >
      <span
        className="absolute top-0 left-0 right-0 h-0.75"
        style={{ background: "var(--color-error)" }}
      />
      <div className="flex flex-col flex-1 p-4 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--color-error)", color: "var(--color-primary)" }}
          >
            <BarChart2 size={16} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-maindark dark:text-primary">
              {t("period_stats.title")}
            </p>
            <p className="text-[11px] leading-tight mt-px text-maindark/45 dark:text-sidebar/45">
              {t(`periods.${period}`)} {t("period_stats.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {periodStats.map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between text-[12px]">
              <span className="text-maindark/50 dark:text-sidebar/50">{label}</span>
              <span className="font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

PeriodStatsCard.displayName = "PeriodStatsCard";

// ─── RevenueChart ─────────────────────────────────────────────────────────────

const RevenueChart = memo(({ data }: { data: Array<{ date: string; revenue: number }> }) => {
  const { t } = useTranslation("dashboard");
  const [activeType, setActiveType] = useState<ChartType>("Area");

  const chart = useCallback(() => {
    if (activeType === "Bar") return <BarVariant data={data} />;
    if (activeType === "Combo") return <ComboVariant data={data} />;
    return <AreaVariant data={data} />;
  }, [activeType, data]);

  return (
    <div
      className="rounded-2xl p-5 mt-4
        bg-sidebar dark:bg-maindark
        border border-black/[0.07] dark:border-primarydark/30"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[14px] font-semibold tracking-[-0.1px] text-maindark dark:text-primary">
          {t("chart.title")}
        </h3>
        <div
          className="flex p-0.75 rounded-lg gap-0.5"
          style={{
            background: "rgba(76,87,152,0.2)",
            border: "1px solid rgba(76,87,152,0.35)",
          }}
        >
          {CHART_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className="px-3.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150"
              style={{
                background: activeType === type ? "var(--color-main)" : "transparent",
                color: activeType === type ? "var(--color-primary)" : "rgba(244,245,250,0.4)",
              }}
            >
              {t(`chart.types.${type.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {chart()}
      </ResponsiveContainer>

      <p className="text-center text-[11px] mt-2.5 tracking-[0.2px] text-maindark/30 dark:text-sidebar/30">
        {t("chart.description")}
      </p>
    </div>
  );
});

RevenueChart.displayName = "RevenueChart";

// ─── FinancialAnalysis ────────────────────────────────────────────────────────

export interface FinancialAnalysisProps {
  totalOrders: number;  // orders.acceptedCount
  sold: number;         // orders.soldAndPaid
  profit: number;       // orders.profit
  startDate?: string;
  endDate?: string;
}

const FinancialAnalysis = memo(
  ({ sold, profit, startDate, endDate }: FinancialAnalysisProps) => {
  const { t } = useTranslation("dashboard");
  const { getRevenue } = useDashboard();
  const [period, setPeriod] = useState<RevenuePeriod>("daily");

  const revenueParams = useMemo(() => {
    const params: Record<string, string> = { period };
    if (startDate) {
      params.startDate = startDate;
      params.start_day = startDate;
    }
    if (endDate) {
      params.endDate = endDate;
      params.end_day = endDate;
    }
    return params;
  }, [endDate, period, startDate]);

  const { data } = getRevenue(revenueParams);
  const revenuePayload = data?.data;
  const rawRevenuePoints = Object.values(revenuePayload ?? {}).filter(
    (item): item is RevenuePoint =>
      typeof item === "object"
      && item !== null
      && "label" in item
      && "revenue" in item
      && "ordersCount" in item,
  );
  const chartData = (
    revenuePayload?.chart?.labels?.length && revenuePayload?.chart?.values?.length
      ? revenuePayload.chart.labels.map((label, index) => ({
        date: label,
        revenue: Number(revenuePayload.chart?.values?.[index] ?? 0),
      }))
      : rawRevenuePoints.map((item) => ({
        date: item.label,
        revenue: Number(item.revenue ?? 0),
      }))
  );
  const currentPoint = rawRevenuePoints[0];
  const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrdersFromRevenue = rawRevenuePoints.reduce(
    (sum, item) => sum + Number(item.ordersCount ?? 0),
    0,
  );
  const finance = revenuePayload?.finance;
  const currentSituation = Number(finance?.currentSituation ?? 0);

  const profitIsNegative = profit < 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} style={{ color: "var(--color-main)" }} />
          <div>
            <h2
              className="text-[15px] font-semibold leading-tight"
              style={{ color: "var(--color-primary)" }}
            >
              {t("financial_analysis.title")}
            </h2>
            <p
              className="text-[11px]"
              style={{ color: "var(--color-sidebar)", opacity: 0.45 }}
            >
              {t("financial_analysis.subtitle")}
            </p>
          </div>
        </div>

        <div
          className="flex p-0.75 rounded-lg gap-0.5"
          style={{
            background: "rgba(76,87,152,0.15)",
            border: "1px solid rgba(76,87,152,0.3)",
          }}
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150"
              style={{
                background: period === p ? "var(--color-main)" : "transparent",
                color:
                  period === p ? "var(--color-primary)" : "rgba(244,245,250,0.4)",
              }}
            >
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* orders.profit */}
        <FinanceCard
          title={t("financial_cards.today_revenue.title")}
          subtitle={t("financial_cards.today_revenue.subtitle")}
          value={formatCurrency(Number(currentPoint?.revenue ?? profit))}
          currency="UZS"
          valueLabel={t("financial_cards.today_revenue.value_label")}
          trendUp={!profitIsNegative}
          icon={<DollarSign size={15} />}
          variant="success"
        />
        {/* orders.soldAndPaid */}
        <FinanceCard
          title={t("financial_cards.today_orders.title")}
          subtitle={t("financial_cards.today_orders.subtitle")}
          value={String(Number(currentPoint?.ordersCount ?? sold))}
          currency=""
          valueLabel={t("financial_cards.today_orders.value_label")}
          icon={<ShoppingCart size={15} />}
          variant="info"
        />
        {/* orders.profit (weekly placeholder — same data for now) */}
        <FinanceCard
          title={t("financial_cards.week_revenue.title")}
          subtitle={t("financial_cards.week_revenue.subtitle")}
          value={formatCurrency(currentSituation || totalRevenue)}
          currency="UZS"
          valueLabel={t("financial_cards.week_revenue.value_label")}
          trendUp={(currentSituation || totalRevenue) >= 0}
          icon={<DollarSign size={15} />}
          variant="warning"
        />
        {/* orders.acceptedCount, soldAndPaid, profit */}
        <PeriodStatsCard
          totalOrders={totalOrdersFromRevenue}
          sold={sold}
          profit={totalRevenue}
          period={period}
        />
      </div>

      <RevenueChart data={chartData} />
    </section>
  );
});

FinancialAnalysis.displayName = "FinancialAnalysis";

export default FinancialAnalysis;
