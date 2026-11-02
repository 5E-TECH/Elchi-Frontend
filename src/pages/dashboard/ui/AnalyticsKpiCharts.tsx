// dizayn-v2: superadmin-ops-system
import type { ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";

/**
 * «Analitika KPI» ning kichik grafiklari (maket `superadmin-ops-system`, CODE-MAP 2.9):
 *  - `SlaGauge` — `.el-gauge` (312×176 SVG yarim doira; zona ≥ 70 success · 40–70 warning · < 40 danger;
 *    trek — zona `*-soft`, yoy — zona rangi, strelka `text`, markaz doirasi `surface` chegarali);
 *  - `KpiRing` — `.el-ring` (72 px halqa: trek `action-soft`, yoy `chart-1`, markazda foiz).
 * Ranglar faqat tokenlardan (`stroke-*` / `fill-*` Tailwind klasslari).
 */

export type GaugeZone = "success" | "warning" | "danger";

const gaugeZone = (value: number): GaugeZone => (value >= 70 ? "success" : value >= 40 ? "warning" : "danger");

const ZONE_TRACK: Record<GaugeZone, string> = {
  success: "stroke-success-soft",
  warning: "stroke-warning-soft",
  danger: "stroke-danger-soft",
};

const ZONE_ARC: Record<GaugeZone, string> = {
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
};

const CX = 156;
const CY = 150;
const R = 120;
const STROKE = 22;

/** 0–100 qiymat → yarim doiradagi nuqta (0 — chapda, 100 — o'ngda). */
const point = (percent: number, radius = R) => {
  const angle = Math.PI * (1 - Math.max(0, Math.min(percent, 100)) / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

const arcPath = (from: number, to: number, radius = R) => {
  const start = point(from, radius);
  const end = point(to, radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

const TICKS = [0, 25, 50, 75, 100];

export const SlaGauge = ({
  value,
  valueText,
  label,
  badge,
  ariaLabel,
}: {
  value: number;
  valueText: string;
  label: string;
  badge?: ReactNode;
  ariaLabel: string;
}) => {
  const zone = gaugeZone(value);
  const needle = point(value, R - STROKE - 10);
  return (
    <figure role="img" aria-label={ariaLabel} className="m-0 flex min-w-0 flex-col items-center gap-3">
      <div aria-hidden="true" className="relative h-[176px] w-[312px] max-w-full flex-none">
        <svg viewBox="0 0 312 176" className="size-full overflow-visible">
          <path d={arcPath(0, 100)} fill="none" strokeWidth={STROKE} strokeLinecap="round" className={ZONE_TRACK[zone]} />
          {value > 0 ? (
            <path d={arcPath(0, value)} fill="none" strokeWidth={STROKE} strokeLinecap="round" className={ZONE_ARC[zone]} />
          ) : null}
          <line
            x1={CX}
            y1={CY}
            x2={needle.x}
            y2={needle.y}
            strokeWidth={4}
            strokeLinecap="round"
            className="stroke-text"
          />
          <circle cx={CX} cy={CY} r={9} strokeWidth={2} className="fill-text stroke-surface" />
        </svg>
        {TICKS.map((tick) => {
          const at = point(tick, R + STROKE / 2 + 16);
          return (
            <span
              key={tick}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-text-subtle tabular-nums"
              style={{ left: at.x, top: at.y }}
            >
              {tick}
            </span>
          );
        })}
      </div>
      <figcaption className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[40px] leading-[44px] font-bold tracking-[-.02em] text-text proportional-nums max-md:text-4xl">
          {valueText}
        </span>
        <span className="text-[13px] leading-[18px] text-text-muted">{label}</span>
        {badge}
      </figcaption>
    </figure>
  );
};

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

export const KpiRing = ({ value, valueText, ariaLabel }: { value: number; valueText: string; ariaLabel: string }) => {
  const share = Math.max(0, Math.min(value, 100)) / 100;
  return (
    <div role="img" aria-label={ariaLabel} className="relative size-[72px] flex-none">
      <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
        <circle cx={36} cy={36} r={RING_R} fill="none" strokeWidth={8} className="stroke-action-soft" />
        {share > 0 ? (
          <circle
            cx={36}
            cy={36}
            r={RING_R}
            fill="none"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${(RING_C * share).toFixed(2)} ${RING_C.toFixed(2)}`}
            className="stroke-chart-1"
          />
        ) : null}
      </svg>
      <span
        aria-hidden="true"
        className={cx("absolute inset-0 flex items-center justify-center text-[13px] font-bold text-text proportional-nums")}
      >
        {valueText}
      </span>
    </div>
  );
};
