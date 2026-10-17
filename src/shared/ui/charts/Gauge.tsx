// dizayn-v2: tizim-charts
import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatPercentLocalized } from "../../lib/formatMoney";
import { Badge } from "../primitives";
import { CHART_SOFT, CHART_SOFT_STROKE, CHART_STROKE, clampPercent, successZoneTone, type ChartTone } from "./tone";

/** Spidometr ostidagi ko'rsatkich (`.el-gauge-stat`): «241 ta · Sotilgan». */
export interface GaugeStat {
  key: string;
  value: string;
  label: string;
  tone: ChartTone;
  icon: LucideIcon;
}

export interface GaugeProps {
  /** 0..100 */
  value: number;
  /** Qiymat ostidagi yorliq: «Sotilgan / qabul qilingan». */
  label: string;
  ariaLabel: string;
  /** `md` — 312×176 (maket), `sm` — 240×135 (dialog, tor karta). */
  size?: "md" | "sm";
  /** Tashqi halqadagi nuqta: «Kecha · 74,8%», «Kompaniya bo'yicha · 77,2%» (yorlig'i legendada). */
  marker?: { value: number; label: string };
  /** Maqsad chizig'i (`Maqsad · 80%`) — ixtiyoriy. */
  target?: number;
  /** Pastki qator (`.el-gauge-foot`): sotilgan / bekor qilingan. */
  stats?: GaugeStat[];
  className?: string;
}

// Maket geometriyasi (312×176): markaz (156, 150), iz radiusi 96, zona yoylari 114, belgilar 120–126.
const W = 312;
const H = 176;
const CX = 156;
const CY = 150;
const R_TRACK = 96;
const R_ZONE = 114;
const R_TICK_IN = 120;
const R_TICK_OUT = 126;
const R_TICK_LABEL = 140;
const R_NEEDLE = 78;
const TICKS = [0, 25, 50, 75, 100] as const;

/** Qiymat (0..100) → shkaladagi nuqta: 0 — chap, 100 — o'ng, yuqori yarim aylana. */
const point = (value: number, radius: number) => {
  const angle = Math.PI * (1 - clampPercent(value) / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

const arc = (from: number, to: number, radius: number) => {
  const start = point(from, radius);
  const end = point(to, radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

const ZONE_ICON = { success: CircleCheck, warning: TriangleAlert, danger: CircleAlert } as const;
const ZONE_KEY = { success: "good", warning: "mid", danger: "low" } as const;

/**
 * SPIDOMETR (`.el-gauge`, `tizim-charts`): zona ≥ 70 success / 40–70 warning / < 40 danger.
 * Oddiy SVG (recharts emas — dashboard byudjeti). Zona badge'ini o'zi chizadi
 * (`dashboard:v2Charts.zone.*`). Yonidagi legenda («Kecha · 74,8%») — chaqiruvchida (`ChartLegend`).
 */
export const Gauge = ({ value, label, ariaLabel, size = "md", marker, target, stats, className }: GaugeProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const safe = clampPercent(value);
  const zone = successZoneTone(safe);
  const ZoneIcon = ZONE_ICON[zone];
  const tip = point(safe, R_NEEDLE);
  // Strelka asosi — markazdan perpendikulyar 4,5 px.
  const angle = Math.PI * (1 - safe / 100);
  const bx = 4.5 * Math.sin(angle);
  const by = 4.5 * Math.cos(angle);
  const markerPoint = marker ? point(marker.value, R_ZONE) : null;
  const targetIn = target == null ? null : point(target, 84);
  const targetOut = target == null ? null : point(target, 118);

  return (
    <figure role="img" aria-label={ariaLabel} className={cx("m-0 flex min-w-0 flex-col items-center", className)}>
      <div
        className={cx("relative max-w-full flex-none", size === "md" ? "w-[312px]" : "w-[240px]")}
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          <path d={arc(0, 39.7, R_ZONE)} fill="none" stroke={CHART_STROKE.danger} strokeWidth={4} strokeOpacity={0.55} />
          <path d={arc(40.3, 69.7, R_ZONE)} fill="none" stroke={CHART_STROKE.warning} strokeWidth={4} strokeOpacity={0.55} />
          <path d={arc(70.3, 100, R_ZONE)} fill="none" stroke={CHART_STROKE.success} strokeWidth={4} strokeOpacity={0.55} />
          <path d={arc(0, 100, R_TRACK)} fill="none" stroke={CHART_SOFT_STROKE[zone]} strokeWidth={16} strokeLinecap="round" />
          {safe > 0 ? (
            <path d={arc(0, safe, R_TRACK)} fill="none" stroke={CHART_STROKE[zone]} strokeWidth={16} strokeLinecap="round" />
          ) : null}
          {TICKS.map((tick) => {
            const inner = point(tick, R_TICK_IN);
            const outer = point(tick, R_TICK_OUT);
            return (
              <path
                key={tick}
                d={`M ${inner.x.toFixed(2)} ${inner.y.toFixed(2)} L ${outer.x.toFixed(2)} ${outer.y.toFixed(2)}`}
                stroke="var(--color-text-subtle)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}
          {targetIn && targetOut ? (
            <g data-gauge-target="">
              <path
                d={`M ${targetIn.x.toFixed(2)} ${targetIn.y.toFixed(2)} L ${targetOut.x.toFixed(2)} ${targetOut.y.toFixed(2)}`}
                stroke="var(--color-surface)"
                strokeWidth={6}
                strokeLinecap="round"
              />
              <path
                d={`M ${targetIn.x.toFixed(2)} ${targetIn.y.toFixed(2)} L ${targetOut.x.toFixed(2)} ${targetOut.y.toFixed(2)}`}
                stroke="var(--color-text)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </g>
          ) : null}
          {markerPoint ? (
            <circle
              data-gauge-marker=""
              cx={markerPoint.x}
              cy={markerPoint.y}
              r={5}
              fill="var(--color-text-subtle)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ) : null}
          <path
            d={`M ${(CX - bx).toFixed(2)} ${(CY - by).toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${(CX + bx).toFixed(2)} ${(CY + by).toFixed(2)} Z`}
            fill="var(--color-text)"
            stroke="var(--color-text)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <circle cx={CX} cy={CY} r={9} fill="var(--color-text)" stroke="var(--color-surface)" strokeWidth={2} />
          <circle cx={CX} cy={CY} r={3} fill="var(--color-surface)" />
        </svg>
        {TICKS.map((tick) => {
          const at = point(tick, R_TICK_LABEL);
          return (
            <span
              key={tick}
              aria-hidden="true"
              className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-text-subtle tabular-nums"
              style={{ left: `${(at.x / W) * 100}%`, top: `${(at.y / H) * 100}%` }}
            >
              {tick}
            </span>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span
          data-gauge-value=""
          className={cx(
            "font-bold tracking-[-.02em] text-text proportional-nums",
            size === "md" ? "text-[40px] leading-[44px] max-md:text-4xl" : "text-[28px] leading-8",
          )}
        >
          {formatPercentLocalized(safe, { language: i18n.language })}
        </span>
        <span className="text-[13px] leading-[18px] text-text-muted">{label}</span>
        <Badge tone={zone} icon={ZoneIcon}>
          {t(`v2Charts.zone.${ZONE_KEY[zone]}`)}
        </Badge>
      </div>
      {stats && stats.length > 0 ? (
        <div className="mt-2 grid w-full grid-cols-2 gap-3 border-t border-border pt-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.key} className="flex min-w-0 items-center gap-2.5">
                <span className={cx("inline-flex size-8 flex-none items-center justify-center rounded-full", CHART_SOFT[stat.tone])}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col text-left">
                  <span className="whitespace-nowrap text-base font-bold text-text">{stat.value}</span>
                  <span className="truncate text-xs text-text-muted">{stat.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </figure>
  );
};
