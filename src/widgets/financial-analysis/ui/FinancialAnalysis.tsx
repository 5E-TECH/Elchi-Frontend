import { memo, useState, useCallback } from "react";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartType = "Area" | "Bar" | "Combo";
type Period = "Daily" | "Weekly" | "Monthly" | "Yearly";
type ColorVariant = "success" | "info" | "warning" | "error";

interface FinanceCardProps {
  title: string;
  subtitle: string;
  value: string;
  currency?: string;
  valueLabel?: string;
  trend?: string;
  trendValue?: string;
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

// ─── Static data ──────────────────────────────────────────────────────────────

const CHART_TYPES: ChartType[] = ["Area", "Bar", "Combo"];
const PERIODS: Period[] = ["Daily", "Weekly", "Monthly", "Yearly"];

const PERIOD_STATS: PeriodStatItem[] = [
  {
    label: "Total Revenue:",
    value: "248.3M UZS",
    color: "var(--color-success)",
  },
  { label: "Orders:", value: "16793", color: "var(--color-info)" },
  { label: "Average:", value: "8.0M UZS", color: "var(--color-main)" },
];

const CHART_DATA = [
  { date: "11.02", revenue: 4.2 },
  { date: "12.02", revenue: 7.8 },
  { date: "13.02", revenue: 6.5 },
  { date: "14.02", revenue: 9.1 },
  { date: "15.02", revenue: 10.2 },
  { date: "16.02", revenue: 9.8 },
  { date: "17.02", revenue: 7.2 },
  { date: "18.02", revenue: 7.0 },
  { date: "19.02", revenue: 6.8 },
  { date: "20.02", revenue: 7.1 },
  { date: "21.02", revenue: 10.5 },
  { date: "22.02", revenue: 14.8 },
  { date: "23.02", revenue: 7.2 },
  { date: "24.02", revenue: 6.4 },
  { date: "25.02", revenue: 7.9 },
  { date: "26.02", revenue: 8.1 },
  { date: "27.02", revenue: 7.3 },
  { date: "28.02", revenue: 6.5 },
  { date: "01.03", revenue: 6.2 },
  { date: "02.03", revenue: 6.8 },
  { date: "03.03", revenue: 7.0 },
  { date: "04.03", revenue: 11.5 },
  { date: "05.03", revenue: 12.8 },
  { date: "06.03", revenue: 5.2 },
  { date: "07.03", revenue: 14.1 },
  { date: "08.03", revenue: 8.9 },
  { date: "09.03", revenue: 7.6 },
  { date: "10.03", revenue: 9.1 },
  { date: "11.03", revenue: 27.4 },
  { date: "12.03", revenue: 4.2 },
  { date: "13.03", revenue: 0.8 },
];

// ─── Chart constants ──────────────────────────────────────────────────────────

const PURPLE_HEX = "#576adb";
const GREEN_HEX = "#3ecf8e";

const sharedAxisProps = {
  tick: { fill: "rgba(244,245,250,0.35)", fontSize: 10 },
  axisLine: false as const,
  tickLine: false as const,
};

const sharedGridProps = {
  stroke: "rgba(76,87,152,0.25)",
  strokeDasharray: "4 4",
  vertical: false,
};

const formatY = (v: number) => (v === 0 ? "0" : `${v.toFixed(0)}M`);

// ─── Chart variants ───────────────────────────────────────────────────────────

const AreaVariant = () => (
  <AreaChart data={CHART_DATA}>
    <defs>
      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={PURPLE_HEX} stopOpacity={0.25} />
        <stop offset="100%" stopColor={PURPLE_HEX} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid {...sharedGridProps} />
    <XAxis dataKey="date" {...sharedAxisProps} interval={2} />
    <YAxis tickFormatter={formatY} {...sharedAxisProps} />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="revenue"
      stroke={PURPLE_HEX}
      strokeWidth={2}
      fill="url(#revenueGrad)"
      dot={false}
      activeDot={{ r: 5, fill: PURPLE_HEX, stroke: "#fff", strokeWidth: 2 }}
    />
  </AreaChart>
);

const BarVariant = () => (
  <BarChart data={CHART_DATA} barSize={10}>
    <CartesianGrid {...sharedGridProps} />
    <XAxis dataKey="date" {...sharedAxisProps} interval={2} />
    <YAxis tickFormatter={formatY} {...sharedAxisProps} />
    <Tooltip content={<CustomTooltip />} />
    <Bar
      dataKey="revenue"
      fill={PURPLE_HEX}
      fillOpacity={0.7}
      radius={[3, 3, 0, 0]}
    />
  </BarChart>
);

const ComboVariant = () => (
  <ComposedChart data={CHART_DATA} barSize={10}>
    <CartesianGrid {...sharedGridProps} />
    <XAxis dataKey="date" {...sharedAxisProps} interval={2} />
    <YAxis tickFormatter={formatY} {...sharedAxisProps} />
    <Tooltip content={<CustomTooltip />} />
    <Bar
      dataKey="revenue"
      fill={PURPLE_HEX}
      fillOpacity={0.35}
      radius={[3, 3, 0, 0]}
    />
    <Line
      type="monotone"
      dataKey="revenue"
      stroke={GREEN_HEX}
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 4, fill: GREEN_HEX }}
    />
  </ComposedChart>
);

const CHART_MAP: Record<ChartType, React.ReactElement> = {
  Area: <AreaVariant />,
  Bar: <BarVariant />,
  Combo: <ComboVariant />,
};

// ─── CustomTooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[11px]"
      style={{
        background: "var(--color-maindark)",
        border: "1px solid rgba(76,87,152,0.5)",
        color: "var(--color-primary)",
      }}
    >
      <p
        className="mb-1 font-semibold"
        style={{ color: "var(--color-sidebar)", opacity: 0.5 }}
      >
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: entry.color }}>
          {entry.value.toFixed(1)}M UZS
        </p>
      ))}
    </div>
  );
};

// ─── FinanceCard ──────────────────────────────────────────────────────────────

const FinanceCard = memo(
  ({
    title,
    subtitle,
    value,
    currency = "UZS",
    valueLabel,
    trend,
    trendValue,
    compareLabel,
    compareValue,
    icon,
    variant,
  }: FinanceCardProps) => {
    const accentColor = `var(--color-${variant})`;
    return (
      <div
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          background: "var(--color-maindark)",
          border: "1px solid rgba(76,87,152,0.25)",
        }}
      >
        <span
          className="absolute top-0 left-0 right-0 h-0.75"
          style={{ background: accentColor }}
        />

        <div className="flex flex-col flex-1 p-4 pt-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: accentColor,
                  color: "var(--color-primary)",
                }}
              >
                {icon}
              </div>
              <div>
                <p
                  className="text-[13px] font-semibold leading-tight"
                  style={{ color: "var(--color-primary)" }}
                >
                  {title}
                </p>
                <p
                  className="text-2.5 leading-tight mt-px"
                  style={{ color: "var(--color-sidebar)", opacity: 0.45 }}
                >
                  {subtitle}
                </p>
              </div>
            </div>
            <Info
              size={13}
              style={{ color: "var(--color-sidebar)", opacity: 0.3 }}
              className="mt-0.5"
            />
          </div>

          {/* Value + trend */}
          <div className="flex items-end justify-between mb-1">
            <div>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-[22px] font-bold leading-none tracking-tight"
                  style={{ color: "var(--color-primary)" }}
                >
                  {value}
                </span>
                {currency && (
                  <span
                    className="text-2.5 font-semibold"
                    style={{ color: "var(--color-sidebar)", opacity: 0.45 }}
                  >
                    {currency}
                  </span>
                )}
              </div>
              {valueLabel && (
                <p
                  className="text-2.5 mt-0.5"
                  style={{ color: "var(--color-sidebar)", opacity: 0.4 }}
                >
                  {valueLabel}
                </p>
              )}
            </div>

            {trend && (
              <div className="text-right">
                <p
                  className="text-[11px] font-bold"
                  style={{ color: "var(--color-error)" }}
                >
                  ↓ {trend}
                </p>
                {trendValue && (
                  <p
                    className="text-2.5 font-semibold mt-px"
                    style={{ color: "var(--color-error)" }}
                  >
                    {trendValue}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compare footer */}
        {compareLabel && (
          <div
            className="flex items-center justify-between px-4 py-2.5 text-[11px]"
            style={{ borderTop: "1px solid rgba(76,87,152,0.2)" }}
          >
            <span
              className="flex items-center gap-1"
              style={{ color: "var(--color-sidebar)", opacity: 0.45 }}
            >
              <TrendingDown size={11} />
              {compareLabel}
            </span>
            <span
              className="font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              {compareValue}
            </span>
          </div>
        )}
      </div>
    );
  },
);
FinanceCard.displayName = "FinanceCard";

// ─── PeriodStatsCard ──────────────────────────────────────────────────────────

const PeriodStatsCard = memo(() => (
  <div
    className="relative flex flex-col rounded-xl overflow-hidden"
    style={{
      background: "var(--color-maindark)",
      border: "1px solid rgba(76,87,152,0.25)",
    }}
  >
    <span
      className="absolute top-0 left-0 right-0 h-0.75"
      style={{ background: "var(--color-error)" }}
    />
    <div className="flex flex-col flex-1 p-4 pt-5">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7.5 h-7.5 rounded-lg flex items-center justify-center"
          style={{
            background: "var(--color-error)",
            color: "var(--color-primary)",
          }}
        >
          <BarChart2 size={15} />
        </div>
        <div>
          <p
            className="text-[13px] font-semibold leading-tight"
            style={{ color: "var(--color-primary)" }}
          >
            Chart Period
          </p>
          <p
            className="text-2.5 leading-tight mt-px"
            style={{ color: "var(--color-sidebar)", opacity: 0.45 }}
          >
            Daily statistics
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {PERIOD_STATS.map(({ label, value, color }) => (
          <div
            key={label}
            className="flex items-center justify-between text-[12px]"
          >
            <span style={{ color: "var(--color-sidebar)", opacity: 0.5 }}>
              {label}
            </span>
            <span className="font-semibold" style={{ color }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
));
PeriodStatsCard.displayName = "PeriodStatsCard";

// ─── RevenueChart ─────────────────────────────────────────────────────────────

const RevenueChart = memo(() => {
  const [activeType, setActiveType] = useState<ChartType>("Area");
  const chart = useCallback(() => CHART_MAP[activeType], [activeType]);

  return (
    <div
      className="rounded-2xl p-5 mt-5"
      style={{
        background: "var(--color-maindark)",
        border: "1px solid rgba(76,87,152,0.3)",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3
          className="text-[14px] font-semibold tracking-[-0.1px]"
          style={{ color: "var(--color-primary)" }}
        >
          Daily revenue trend
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
                background:
                  activeType === type ? "var(--color-main)" : "transparent",
                color:
                  activeType === type
                    ? "var(--color-primary)"
                    : "rgba(244,245,250,0.4)",
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {chart()}
      </ResponsiveContainer>

      <p
        className="text-center text-2.5 mt-2.5 tracking-[0.2px]"
        style={{ color: "rgba(244,245,250,0.3)" }}
      >
        Revenue = Market tariff - Courier tariff (only sold orders are counted)
      </p>
    </div>
  );
});
RevenueChart.displayName = "RevenueChart";

// ─── FinancialAnalysis ────────────────────────────────────────────────────────

const FinancialAnalysis = () => {
  const [period, setPeriod] = useState<Period>("Daily");

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
              Financial Analysis
            </h2>
            <p
              className="text-[11px]"
              style={{ color: "var(--color-sidebar)", opacity: 0.45 }}
            >
              Period Analysis
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
              className="px-3.5 py-1.25 rounded-md text-[11px] font-semibold transition-all duration-150"
              style={{
                background: period === p ? "var(--color-main)" : "transparent",
                color:
                  period === p
                    ? "var(--color-primary)"
                    : "rgba(244,245,250,0.4)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceCard
          title="Today's Revenue"
          subtitle="Compared with yesterday"
          value="1.1M"
          currency="UZS"
          valueLabel="Today"
          trend="95.7%"
          trendValue="-24,765,000"
          compareLabel="Yesterday:"
          compareValue="25.9M UZS"
          icon={<DollarSign size={15} />}
          variant="success"
        />
        <FinanceCard
          title="Today's Orders"
          subtitle="Compared with yesterday"
          value="74"
          currency=""
          valueLabel="Today"
          trend="95.7%"
          trendValue="-1,641"
          compareLabel="Yesterday:"
          compareValue="2K"
          icon={<ShoppingCart size={15} />}
          variant="info"
        />
        <FinanceCard
          title="This Week's Revenue"
          subtitle="Compared with last week"
          value="52.1M"
          currency="UZS"
          valueLabel="This Week"
          trend="9.1%"
          trendValue="-5,240,000"
          compareLabel="Last Week:"
          compareValue="57.3M UZS"
          icon={<DollarSign size={15} />}
          variant="warning"
        />
        <PeriodStatsCard />
      </div>

      <RevenueChart />
    </section>
  );
};

export default memo(FinancialAnalysis);
