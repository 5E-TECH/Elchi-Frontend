import { memo, useCallback, useMemo, useState } from "react";
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
import { useDashboard } from "../../../entities/dashboard";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_TYPES: ChartType[] = ["Area", "Bar", "Combo"];
const PERIODS: RevenuePeriod[] = ["daily", "weekly", "monthly", "yearly"];

const PERIOD_LABEL: Record<RevenuePeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const VARIANT_COLOR: Record<ColorVariant, string> = {
  info: "var(--color-info)",
  success: "var(--color-success)",
  error: "var(--color-error)",
  warning: "var(--color-warning)",
};

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

const formatY = (v: number) => (v === 0 ? "0" : `${v.toFixed(0)}M`);

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
          {entry.value.toFixed(1)}M UZS
        </p>
      ))}
    </div>
  );
};

// ─── Chart Variants ───────────────────────────────────────────────────────────

const AreaVariant = () => (
  <AreaChart data={CHART_DATA}>
    <defs>
      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={MAIN_COLOR} stopOpacity={0.3} />
        <stop offset="100%" stopColor={MAIN_COLOR} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatY} {...AXIS_PROPS} />
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

const BarVariant = () => (
  <BarChart data={CHART_DATA} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatY} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" fill={MAIN_COLOR} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
  </BarChart>
);

const ComboVariant = () => (
  <ComposedChart data={CHART_DATA} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatY} {...AXIS_PROPS} />
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

const CHART_MAP: Record<ChartType, React.ReactElement> = {
  Area: <AreaVariant />,
  Bar: <BarVariant />,
  Combo: <ComboVariant />,
};

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
  const periodStats: PeriodStatItem[] = [
    {
      label: "Total Revenue:",
      value: `${profit.toLocaleString()} UZS`,
      color: "var(--color-success)",
    },
    {
      label: "Orders:",
      value: String(totalOrders),
      color: "var(--color-info)",
    },
    {
      label: "Sold:",
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
              Chart Period
            </p>
            <p className="text-[11px] leading-tight mt-px text-maindark/45 dark:text-sidebar/45">
              {PERIOD_LABEL[period]} statistics
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

const RevenueChart = memo(() => {
  const [activeType, setActiveType] = useState<ChartType>("Area");
  const chart = useCallback(() => CHART_MAP[activeType], [activeType]);

  return (
    <div
      className="rounded-2xl p-5 mt-4
        bg-sidebar dark:bg-maindark
        border border-black/[0.07] dark:border-primarydark/30"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[14px] font-semibold tracking-[-0.1px] text-maindark dark:text-primary">
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
                background: activeType === type ? "var(--color-main)" : "transparent",
                color: activeType === type ? "var(--color-primary)" : "rgba(244,245,250,0.4)",
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

      <p className="text-center text-[11px] mt-2.5 tracking-[0.2px] text-maindark/30 dark:text-sidebar/30">
        Revenue = Market tariff − Courier tariff (only sold orders are counted)
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
  const revenueData = data?.data?.data;



  // profit UZS da keladi (masalan: 60000), mingga bo'lib ko'rsatamiz
  const profitFormatted = profit.toLocaleString();
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
              className="px-3.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150"
              style={{
                background: period === p ? "var(--color-main)" : "transparent",
                color:
                  period === p ? "var(--color-primary)" : "rgba(244,245,250,0.4)",
              }}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* orders.profit */}
        <FinanceCard
          title="Today's Revenue"
          subtitle="Compared with yesterday"
          value={profitFormatted}
          currency="UZS"
          valueLabel="Today"
          trendUp={!profitIsNegative}
          icon={<DollarSign size={15} />}
          variant="success"
        />
        {/* orders.soldAndPaid */}
        <FinanceCard
          title="Today's Orders"
          subtitle="Compared with yesterday"
          value={String(sold)}
          currency=""
          valueLabel="Today"
          icon={<ShoppingCart size={15} />}
          variant="info"
        />
        {/* orders.profit (weekly placeholder — same data for now) */}
        <FinanceCard
          title="This Week's Revenue"
          subtitle="Compared with last week"
          value={profitFormatted}
          currency="UZS"
          valueLabel="This Week"
          trendUp={!profitIsNegative}
          icon={<DollarSign size={15} />}
          variant="warning"
        />
        {/* orders.acceptedCount, soldAndPaid, profit */}
        <PeriodStatsCard
          totalOrders={Number(revenueData?.[0]?.ordersCount ?? 0)}
          sold={sold}
          profit={Number(revenueData?.[0]?.revenue ?? 0)}
          period={period}
        />
      </div>

      <RevenueChart />
    </section>
  );
});

FinancialAnalysis.displayName = "FinancialAnalysis";

export default FinancialAnalysis;
