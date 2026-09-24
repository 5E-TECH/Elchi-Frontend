import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Store, Truck, Inbox, ChevronDown } from "lucide-react";
import type { TopMarket, TopCourier } from "../../../entities/dashboard";
import { TYPO, TEXT, formatPercent, formatNumber } from "../../../shared/config/designSystem";

const INITIAL_ROWS = 10;

const AXIS_PROPS = {
  tick: { fill: "var(--color-dashboard-chart-axis)", fontSize: 11, fontWeight: 600 },
  axisLine: false as const,
  tickLine: false as const,
};

const GRID_PROPS = {
  stroke: "var(--color-dashboard-chart-grid)",
  strokeDasharray: "4 4",
  horizontal: false,
};

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

// Sotuv foizi bo'yicha rang: yaxshi/o'rtacha/past — foydalanuvchi bir
// qarashda muammoli marketlar/kuryerlarni ajrata olishi uchun.
const rateColor = (rate: number): string =>
  rate >= 70 ? "var(--color-success)" : rate >= 40 ? "var(--color-warning)" : "var(--color-error)";

interface PerformanceRow {
  id: string;
  name: string;
  rate: number;
  total: number;
  successful: number;
}

interface RateTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PerformanceRow }>;
  ordersLabel: string;
}

const RateTooltip = ({ active, payload, ordersLabel }: RateTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="el-card-soft rounded-xl px-3 py-2 text-[11px]">
      <p className="mb-1 font-semibold" style={{ color: TEXT.strong }}>
        {row.name}
      </p>
      <p className="font-bold" style={{ color: rateColor(row.rate) }}>
        {formatPercent(row.rate)}
      </p>
      <p style={{ color: TEXT.soft }}>
        {formatNumber(row.successful)}/{formatNumber(row.total)} {ordersLabel}
      </p>
    </div>
  );
};

interface PerformanceSectionProps {
  title: string;
  icon: React.ReactNode;
  rows: PerformanceRow[];
  emptyText: string;
  ordersLabel: string;
  showMoreLabel: string;
  showLessLabel: string;
}

const PerformanceSection = memo(
  ({ title, icon, rows, emptyText, ordersLabel, showMoreLabel, showLessLabel }: PerformanceSectionProps) => {
    const [expanded, setExpanded] = useState(false);
    const sortedRows = useMemo(() => [...rows].sort((a, b) => b.rate - a.rate), [rows]);
    const hasMore = sortedRows.length > INITIAL_ROWS;
    const visibleRows = expanded ? sortedRows : sortedRows.slice(0, INITIAL_ROWS);
    const chartHeight = Math.max(120, visibleRows.length * 34);

    return (
      <section className="el-card flex min-w-0 flex-col overflow-hidden rounded-2xl p-3 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-main/10 text-main">
            {icon}
          </span>
          <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>{title}</h3>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox size={28} style={{ color: TEXT.soft, opacity: 0.5 }} />
            <p className="text-[12px] font-medium" style={{ color: TEXT.soft }}>
              {emptyText}
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={visibleRows} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} {...AXIS_PROPS} />
                <YAxis type="category" dataKey="name" width={110} {...AXIS_PROPS} />
                <Tooltip content={<RateTooltip ordersLabel={ordersLabel} />} cursor={{ fill: "transparent" }} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                  {visibleRows.map((row) => (
                    <Cell key={row.id} fill={rateColor(row.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="el-glass-control mt-2 flex items-center justify-center gap-1.5 self-center rounded-xl px-3 py-1.5 text-xs font-semibold text-maindark dark:text-primary"
              >
                {expanded ? showLessLabel : showMoreLabel}
                <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </>
        )}
      </section>
    );
  },
);

PerformanceSection.displayName = "PerformanceSection";

export interface PerformanceChartProps {
  markets?: TopMarket[];
  couriers?: TopCourier[];
}

const PerformanceChart = memo(({ markets, couriers }: PerformanceChartProps) => {
  const { t } = useTranslation("dashboard");

  const marketRows: PerformanceRow[] = useMemo(
    () =>
      (markets ?? []).map((market, i) => ({
        id: `market-${market.market_id || "unknown"}-${i}`,
        name: market.market_name || "—",
        rate: clampPercent(toFiniteNumber(market.success_rate)),
        total: toFiniteNumber(market.total_orders),
        successful: toFiniteNumber(market.successful_orders),
      })),
    [markets],
  );

  const courierRows: PerformanceRow[] = useMemo(
    () =>
      (couriers ?? []).map((courier, i) => ({
        id: `courier-${courier.courier_id || "unknown"}-${i}`,
        name: courier.courier_name || "—",
        rate: clampPercent(toFiniteNumber(courier.success_rate)),
        total: toFiniteNumber(courier.total_orders),
        successful: toFiniteNumber(courier.successful_orders),
      })),
    [couriers],
  );

  const showMarkets = markets !== undefined;
  const showCouriers = couriers !== undefined;
  const sectionCount = Number(showMarkets) + Number(showCouriers);

  if (sectionCount === 0) return null;

  return (
    <div className={`grid min-w-0 grid-cols-1 gap-4 ${sectionCount > 1 ? "md:grid-cols-2" : ""}`}>
      {showMarkets && (
        <PerformanceSection
          title={t("performance.markets_title")}
          icon={<Store size={16} />}
          rows={marketRows}
          emptyText={t("performance.empty")}
          ordersLabel={t("performance.orders_label")}
          showMoreLabel={t("performance.show_more")}
          showLessLabel={t("performance.show_less")}
        />
      )}
      {showCouriers && (
        <PerformanceSection
          title={t("performance.couriers_title")}
          icon={<Truck size={16} />}
          rows={courierRows}
          emptyText={t("performance.empty")}
          ordersLabel={t("performance.orders_label")}
          showMoreLabel={t("performance.show_more")}
          showLessLabel={t("performance.show_less")}
        />
      )}
    </div>
  );
});

PerformanceChart.displayName = "PerformanceChart";

export default PerformanceChart;
