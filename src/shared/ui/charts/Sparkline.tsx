// dizayn-v2: tizim-charts
/**
 * SPARKLINE (`.el-kpi .el-spark`, maket `superadmin-dashboard-main`): KPI kartasi ostidagi 14 kunlik chiziq.
 * Oddiy SVG + tokenlar (recharts emas — dashboard byudjeti). `StatCard` ning `children` iga qo'yiladi.
 * Ilgari `pages/branches/ui/BranchMetricsCards.tsx` da (`MetricSparkline`) — bosh sahifa ham ishlatgani uchun shu yerga.
 */
const SPARK_W = 100;
const SPARK_H = 40;
const SPARK_PAD = 4;
const fixed = (value: number) => value.toFixed(1);

/**
 * KPI sparkline (`.el-kpi .el-spark`, 40 px · telefonda 32): oxirgi 14 kun — tarix `chart-muted`, oxirgi kun
 * kesmasi va nuqtasi `chart-1`. Bezak — ma'nosi `aria-label` da (min – max, oxirgi kun).
 */
export const Sparkline = ({ values, label }: { values: readonly number[]; label: string }) => {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * SPARK_W,
    y: span > 0 ? SPARK_PAD + (1 - (value - min) / span) * (SPARK_H - 2 * SPARK_PAD) : SPARK_H / 2,
  }));
  // Silliq chiziq: har kesmada gorizontal urinmali kubik Bezye (o'ta oshib ketmaydi).
  const history = points.slice(0, -1).reduce((path, point, index, all) => {
    if (index === 0) return `M ${fixed(point.x)} ${fixed(point.y)}`;
    const previous = all[index - 1];
    const dx = (point.x - previous.x) / 3;
    return `${path} C ${fixed(previous.x + dx)} ${fixed(previous.y)} ${fixed(point.x - dx)} ${fixed(point.y)} ${fixed(point.x)} ${fixed(point.y)}`;
  }, "");
  const beforeLast = points[points.length - 2];
  const last = points[points.length - 1];
  return (
    <span role="img" aria-label={label} data-sparkline="" className="relative block h-10 min-w-0 max-md:h-8">
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        {points.length > 2 ? (
          <path
            d={history}
            fill="none"
            stroke="var(--color-chart-muted)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path
          d={`M ${fixed(beforeLast.x)} ${fixed(beforeLast.y)} L ${fixed(last.x)} ${fixed(last.y)}`}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-surface"
        style={{ left: "100%", top: `${(last.y / SPARK_H) * 100}%` }}
      />
    </span>
  );
};
