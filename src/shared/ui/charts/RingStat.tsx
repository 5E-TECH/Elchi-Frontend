// dizayn-v2: tizim-charts
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatPercentLocalized } from "../../lib/formatMoney";
import { CHART_SOFT_STROKE, CHART_STROKE, clampPercent, type ChartTone } from "./tone";

export interface RingStatProps {
  /** 0..100 */
  value: number;
  /** Sukut `action` (`chart-1`). */
  tone?: ChartTone;
  /** Yorliq: «O'z vaqtida (SLA)». */
  label: string;
  /** Katta qiymat: «86,4%», «46 ta». */
  valueText: string;
  /** Ostidagi qator: delta + «24 soat ichida». */
  meta?: ReactNode;
  /** Halqa: `md` — 56 px (sukut), `lg` — 72 px. */
  size?: "md" | "lg";
  /** Halqa ichidagi matn (sukut — butun foiz «86%»). */
  ringText?: string;
  className?: string;
}

const RING = { md: { box: 56, radius: 23, stroke: 6 }, lg: { box: 72, radius: 30, stroke: 8 } } as const;

/**
 * HALQA KO'RSATKICH (`.el-ring` + qiymat): kichik foizlar yonma-yon (SLA, bekor qilish, faol
 * kuryerlar). Halqa — bezak (`aria-hidden`), ma'no yonidagi matnda.
 */
export const RingStat = ({
  value,
  tone = "action",
  label,
  valueText,
  meta,
  size = "md",
  ringText,
  className,
}: RingStatProps) => {
  const { i18n } = useTranslation();
  const { box, radius, stroke } = RING[size];
  const circumference = 2 * Math.PI * radius;
  const safe = clampPercent(value);
  return (
    <div className={cx("flex min-w-0 items-center gap-4", className)}>
      <span aria-hidden="true" className="relative shrink-0" style={{ width: box, height: box }}>
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="absolute inset-0">
          <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke={CHART_SOFT_STROKE[tone]} strokeWidth={stroke} />
          {safe > 0 ? (
            <circle
              cx={box / 2}
              cy={box / 2}
              r={radius}
              fill="none"
              stroke={tone === "action" ? "var(--color-chart-1)" : CHART_STROKE[tone]}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${((safe / 100) * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
              transform={`rotate(-90 ${box / 2} ${box / 2})`}
            />
          ) : null}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-text proportional-nums">
          {ringText ?? formatPercentLocalized(safe, { language: i18n.language, fractionDigits: 0 })}
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-text-muted">{label}</span>
        <span className="text-xl leading-7 font-bold text-text proportional-nums">{valueText}</span>
        {meta != null ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">{meta}</span>
        ) : null}
      </div>
    </div>
  );
};
