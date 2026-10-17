// dizayn-v2: tizim-charts
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../lib/formatMoney";
import { LegendKey } from "./ChartLegend";
import { CHART_STROKE, type ChartTone } from "./tone";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  tone: ChartTone;
  icon?: LucideIcon;
}

export interface DonutProps {
  /** ≤ 6 bo'lak (ortig'i chizilmaydi — «Boshqa» chaqiruvchida yig'iladi). */
  segments: DonutSegment[];
  /** Berilmasa — bo'laklar yig'indisi. */
  total?: number;
  /** Markazdagi yorliq: «Jami qabul qilingan». */
  centerLabel: string;
  /** Berilmasa — `formatNumberLocalized(total)`. */
  centerValue?: string;
  /** `md` — 184 px, `sm` — 120 px. */
  size?: "md" | "sm";
  /** `stack` — halqa ustida, legenda ostida; `side` — yonma-yon (telefonda ustma-ust). */
  layout?: "stack" | "side";
  /** Sukut `true` — legenda-jadval (nom · ta · %), grafikning jadval egizagi. */
  showLegend?: boolean;
  /** Legenda ro'yxati nomi (sukut — `ariaLabel`). */
  legendLabel?: string;
  ariaLabel: string;
  className?: string;
}

const GEOMETRY = {
  md: { box: 184, radius: 81, stroke: 22, total: "text-[32px] leading-9" },
  sm: { box: 120, radius: 52, stroke: 16, total: "text-[22px] leading-[26px]" },
} as const;

/** Bo'laklar orasidagi bo'shliq (px, yoy bo'ylab). */
const GAP = 2;

/** Bo'laklar yoylari: uzunlik (bo'shliq ayirilgan) va boshlanish siljishi. */
const donutArcs = (segments: DonutSegment[], sum: number, circumference: number, gap: number) => {
  let offset = 0;
  return segments.map((segment) => {
    const length = sum > 0 ? (Math.max(0, segment.value) / sum) * circumference : 0;
    const item = { key: segment.key, tone: segment.tone, offset, length: Math.max(0, length - gap) };
    offset += length;
    return item;
  });
};

/**
 * HALQA (`.el-donut`, `.el-donut-ring`, `.el-legend-list`): ≤ 6 bo'lak, 12 dan boshlanadi, 2 px
 * bo'shliq, markazda jami. Oddiy SVG (recharts emas). Legenda qatori
 * `grid-cols-[12px_minmax(0,1fr)_auto_52px]` — rang belgisi · (ikonka) nom · «241 ta» · «77,2%».
 */
export const Donut = ({
  segments,
  total,
  centerLabel,
  centerValue,
  size = "md",
  layout = "stack",
  showLegend = true,
  legendLabel,
  ariaLabel,
  className,
}: DonutProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const { box, radius, stroke, total: totalClass } = GEOMETRY[size];
  const circumference = 2 * Math.PI * radius;
  const visible = segments.slice(0, 6);
  const sum = visible.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  const resolvedTotal = total ?? sum;
  const nonZero = visible.filter((segment) => segment.value > 0);
  const gap = nonZero.length > 1 ? GAP : 0;

  const arcs = donutArcs(visible, sum, circumference, gap);

  const share = (value: number) =>
    formatPercentLocalized(resolvedTotal > 0 ? (value / resolvedTotal) * 100 : 0, { language });

  return (
    <div
      className={cx(
        "flex min-w-0",
        layout === "side"
          ? "flex-row flex-wrap items-center gap-x-6 gap-y-4 max-md:flex-col max-md:items-stretch"
          : "flex-col items-stretch gap-4",
        className,
      )}
    >
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative mx-auto shrink-0"
        style={{ width: box, height: box }}
      >
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" className="absolute inset-0">
          <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke="var(--color-sunken)" strokeWidth={stroke} />
          <g transform={`rotate(-90 ${box / 2} ${box / 2})`}>
            {arcs.map((segment) =>
              segment.length > 0 ? (
                <circle
                  key={segment.key}
                  data-donut-segment={segment.key}
                  cx={box / 2}
                  cy={box / 2}
                  r={radius}
                  fill="none"
                  stroke={CHART_STROKE[segment.tone]}
                  strokeWidth={stroke}
                  strokeDasharray={`${segment.length.toFixed(2)} ${circumference.toFixed(2)}`}
                  strokeDashoffset={(-segment.offset).toFixed(2)}
                />
              ) : null,
            )}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
          <span className={cx("font-bold tracking-[-.02em] text-text proportional-nums", totalClass)}>
            {centerValue ?? formatNumberLocalized(resolvedTotal, { language })}
          </span>
          <span className="max-w-[110px] text-xs font-semibold text-text-muted">{centerLabel}</span>
        </div>
      </div>
      {showLegend ? (
        <ul aria-label={legendLabel ?? ariaLabel} className="m-0 flex min-w-0 flex-1 list-none flex-col p-0">
          {visible.map((segment) => {
            const Icon = segment.icon;
            return (
              <li
                key={segment.key}
                className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 border-t border-border py-1.5 text-sm text-text first:border-t-0"
              >
                <LegendKey tone={segment.tone} shape="dot" />
                <span className="flex min-w-0 items-center gap-2">
                  {Icon ? <Icon size={16} aria-hidden="true" className="shrink-0 text-text-muted" /> : null}
                  <span className="truncate">{segment.label}</span>
                </span>
                <span className="whitespace-nowrap text-right font-bold">
                  {t("v2Charts.countTa", { value: formatNumberLocalized(segment.value, { language }) })}
                </span>
                <span className="whitespace-nowrap text-right text-[13px] text-text-muted">{share(segment.value)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
