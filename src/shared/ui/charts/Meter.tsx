// dizayn-v2: tizim-charts
import { cx } from "../../lib/cx";
import { CHART_FILL, CHART_TRACK, clampPercent, type ChartTone } from "./tone";

export interface MeterProps {
  value: number;
  /** Shkala yuqori chegarasi (sukut 100). */
  max?: number;
  /** Sukut — kategorial `chart-1` (`.el-meter`); ton berilsa — `bg-*` / `bg-*-soft`. */
  tone?: ChartTone;
  thickness?: "thin" | "md" | "thick";
  /** Maqsad chizig'i (`.el-meter-target`) — `value` bilan bir shkalada. */
  target?: number;
  ariaLabel?: string;
  className?: string;
}

const HEIGHT: Record<NonNullable<MeterProps["thickness"]>, string> = {
  thin: "h-1.5",
  md: "h-2",
  thick: "h-3",
};

/**
 * O'LCHAGICH (maket `.el-meter`, `.is-thin/.is-thick`, `.el-meter-target`): iz + to'ldirish.
 * `role="meter"` — `ariaLabel` berilsa (yonida matn bo'lmasa, nom majburiy).
 */
export const Meter = ({ value, max = 100, tone, thickness = "md", target, ariaLabel, className }: MeterProps) => {
  const safeMax = max > 0 ? max : 100;
  const percent = clampPercent((value / safeMax) * 100);
  const targetPercent = target == null ? null : clampPercent((target / safeMax) * 100);
  return (
    <div
      role={ariaLabel ? "meter" : undefined}
      aria-label={ariaLabel}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? safeMax : undefined}
      aria-valuenow={ariaLabel ? Math.min(Math.max(value, 0), safeMax) : undefined}
      aria-hidden={ariaLabel ? undefined : true}
      className={cx("relative w-full min-w-0 rounded-full", HEIGHT[thickness], tone ? CHART_TRACK[tone] : "bg-action-soft", className)}
    >
      <span
        className={cx("block h-full rounded-full", tone ? CHART_FILL[tone] : "bg-chart-1")}
        style={{ width: `${percent}%` }}
      />
      {targetPercent != null ? (
        <span
          aria-hidden="true"
          data-meter-target=""
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-text"
          style={{ left: `${targetPercent}%` }}
        />
      ) : null}
    </div>
  );
};
