// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactAxisMoney } from "../../../shared/config/designSystem";
import { formatCompactMoneyLocalized, formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { DeltaChip } from "../../../shared/ui/charts";
import { calculatePercentChange } from "../lib/periodComparison";

/**
 * «MOLIYAVIY TAHLIL» TREND PLOTI — dashboard'dagi YAGONA recharts grafigi (alohida lazy chunk).
 * Kartaning o'zi (sarlavha, segmentlar, xulosa) recharts'siz darhol chiziladi; bu plot faqat plot
 * maydoni ekranga kirganda yuklanadi (`DeferredMount rootMargin="0px"`, §1.9 byudjeti).
 *
 * Ko'rinish (CODE-MAP §2.9): joriy — `chart-1` maydon (0,10 / tungi 0,14), oldingi — `chart-muted`
 * punktir chiziq, faqat gorizontal grid, o'q matni 12px `text-subtle`, oxirgi qiymat yorlig'i, tooltip —
 * `raised` karta (avval qiymat, keyin yorliq). Telefonda tooltip va kursor yo'q.
 */
export interface TrendPoint {
  label: string;
  current: number;
  previous: number | null;
  previousLabel?: string;
  /** Shu bo'lakdagi buyurtmalar soni (`data[].ordersCount`) — «Jadval» ko'rinishida; noma'lum — `null`. */
  orders?: number | null;
}

export interface FinancialTrendPlotProps {
  points: TrendPoint[];
  showPrevious: boolean;
  height: number;
  currentName: string;
  previousName: string;
}

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 12 };

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
  currentName: string;
  previousName: string;
  showPrevious: boolean;
}

export const TrendTooltip = ({ active, payload, currentName, previousName, showPrevious }: TooltipProps) => {
  const { t, i18n } = useTranslation("dashboard");
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const delta = showPrevious ? calculatePercentChange(point.current, point.previous) : null;
  return (
    <div className="flex min-w-[200px] flex-col gap-1.5 rounded-xl border border-border bg-raised px-3 py-2.5 text-[13px] shadow-xl max-md:hidden">
      <span className="whitespace-nowrap text-xs font-semibold text-text-muted">{point.label}</span>
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-chart-1" />
        <span className="font-bold text-text">{formatMoneyLocalized(point.current, { language: i18n.language })}</span>
        <span className="text-text-muted">{currentName}</span>
      </span>
      {showPrevious && point.previous != null ? (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-chart-muted" />
          <span className="font-bold text-text">{formatMoneyLocalized(point.previous, { language: i18n.language })}</span>
          <span className="text-text-muted">{point.previousLabel ?? previousName}</span>
        </span>
      ) : null}
      {delta != null ? (
        <>
          <span aria-hidden="true" className="h-px bg-border" />
          <span className="flex items-center gap-2 whitespace-nowrap text-xs text-text-muted">
            <DeltaChip value={delta} />
            {t("v2Dashboard.vsPrevious")}
          </span>
        </>
      ) : null}
    </div>
  );
};

const isPhone = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches === true;
const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

const FinancialTrendPlot = ({ points, showPrevious, height, currentName, previousName }: FinancialTrendPlotProps) => {
  const { i18n } = useTranslation();
  const phone = isPhone();
  const last = points[points.length - 1];
  return (
    <div className="relative min-w-0" style={{ height }} data-trend-plot="">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: phone ? 56 : 72, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
            interval={phone ? "preserveStartEnd" : "preserveEnd"}
            minTickGap={phone ? 40 : 24}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={phone ? 48 : 56}
            tickFormatter={(value: number) => formatCompactAxisMoney(value)}
            tickCount={phone ? 3 : 4}
          />
          {phone ? null : (
            <Tooltip
              cursor={{ stroke: "var(--color-text-subtle)", strokeDasharray: "3 3" }}
              content={
                <TrendTooltip currentName={currentName} previousName={previousName} showPrevious={showPrevious} />
              }
            />
          )}
          <Area
            type="monotone"
            dataKey="current"
            name={currentName}
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            fill="var(--color-chart-1)"
            fillOpacity={isDark() ? 0.14 : 0.1}
            dot={false}
            activeDot={{ r: 4, fill: "var(--color-chart-1)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          {showPrevious ? (
            <Line
              type="monotone"
              dataKey="previous"
              name={previousName}
              stroke="var(--color-chart-muted)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      {last ? (
        <span className="pointer-events-none absolute right-0 top-2 whitespace-nowrap text-xs font-bold text-text">
          {formatCompactMoneyLocalized(last.current, { language: i18n.language, withCurrency: false })}
        </span>
      ) : null}
    </div>
  );
};

export default memo(FinancialTrendPlot);
