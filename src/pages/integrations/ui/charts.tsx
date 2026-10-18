// dizayn-v2: superadmin-integrations-partners-console, superadmin-integrations-panel-shipments, superadmin-integrations-panel-events
import type { ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";
import { Badge, TONE_SOFT, type Tone } from "../../../shared/ui/primitives";

/**
 * Integratsiyalar bo'limining kichik grafiklari (CODE-MAP 2.9, taxta `tizim-charts`):
 *  - `SegBar` — `.el-segbar`: bo'laklar `flex` nisbatida (ulush), `min-w-1`, 2 px oraliq;
 *  - `LegendList` — `.el-legend-list`: rang kaliti + nom + qiymat + foiz qatorlari;
 *  - `SuccessGauge` — `.el-gauge`: 312×176 yarim doira (≥ 70 success · 40–70 warning · < 40 danger);
 *    o'lchanmagan (`null`) — neytral trek, strelka yo'q, «—».
 * Ranglar faqat tokenlardan (`bg-*`, `stroke-*` klasslari).
 */

export type SegPart = {
  /** Bo'lak qiymati (son). 0 — chizilmaydi. */
  value: number;
  /** Fon klassi: `bg-success`, `bg-warning`, `bg-danger`, `bg-chart-1`, `bg-chart-muted` … */
  className: string;
};

export const SegBar = ({
  parts,
  ariaLabel,
  className,
  size = "md",
}: {
  parts: readonly SegPart[];
  ariaLabel: string;
  className?: string;
  /** `sm` — 6 px (jadval katagi), `md` — 8 px, `lg` — 12 px. */
  size?: "sm" | "md" | "lg";
}) => {
  const shown = parts.filter((part) => part.value > 0);
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cx(
        "flex w-full min-w-0 gap-0.5 overflow-hidden rounded-[4px]",
        size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2",
        shown.length === 0 && "bg-sunken",
        className,
      )}
    >
      {shown.map((part, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cx("block h-full min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", part.className)}
          style={{ flex: `${part.value} 1 0` }}
        />
      ))}
    </span>
  );
};

export type LegendRow = {
  key: string;
  /** Rang kaliti klassi (`bg-success` …). */
  keyClassName: string;
  label: ReactNode;
  /** Ikonka (ixtiyoriy, rang emas — ma'no matn bilan). */
  icon?: ReactNode;
  value: ReactNode;
  /** Foiz matni («97,6%»). */
  share?: ReactNode;
};

export const LegendList = ({ rows, ariaLabel, className }: { rows: readonly LegendRow[]; ariaLabel: string; className?: string }) => (
  <ul aria-label={ariaLabel} className={cx("flex min-w-0 flex-col", className)}>
    {rows.map((row) => (
      <li
        key={row.key}
        className="grid min-h-10 grid-cols-[10px_minmax(0,1fr)_auto_3.5rem] items-center gap-x-3 border-b border-border py-2 text-[13px] last:border-b-0"
      >
        <span aria-hidden="true" className={cx("size-2.5 rounded-[3px]", row.keyClassName)} />
        <span className="flex min-w-0 items-center gap-1.5 text-text">
          {row.icon}
          <span className="truncate">{row.label}</span>
        </span>
        <span className="whitespace-nowrap text-right font-semibold text-text tabular-nums">{row.value}</span>
        <span className="whitespace-nowrap text-right text-xs text-text-muted tabular-nums">{row.share ?? ""}</span>
      </li>
    ))}
  </ul>
);

/** Kichik inline legenda (`.el-legend`) — jadval ostida. */
export const InlineLegend = ({ items }: { items: ReadonlyArray<{ key: string; label: ReactNode; className: string }> }) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
    {items.map((item) => (
      <li key={item.key} className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={cx("size-2.5 rounded-[3px]", item.className)} />
        {item.label}
      </li>
    ))}
  </ul>
);

/* ─── Yarim doira «speedometr» ──────────────────────────────────────────────── */

type GaugeZone = "success" | "warning" | "danger";

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
const TICKS = [0, 25, 50, 75, 100];

const point = (percent: number, radius = R) => {
  const angle = Math.PI * (1 - Math.max(0, Math.min(percent, 100)) / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

const arcPath = (from: number, to: number, radius = R) => {
  const start = point(from, radius);
  const end = point(to, radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

export type GaugeStat = { key: string; tone: Tone; icon: ReactNode; value: ReactNode; label: ReactNode };

export const SuccessGauge = ({
  value,
  valueText,
  label,
  badge,
  ariaLabel,
  stats,
}: {
  /** 0–100 yoki `null` (o'lchanmagan). */
  value: number | null;
  valueText: string;
  label: ReactNode;
  badge?: ReactNode;
  ariaLabel: string;
  stats?: readonly GaugeStat[];
}) => {
  const zone = value === null ? null : gaugeZone(value);
  const needle = value === null ? null : point(value, R - STROKE - 10);
  return (
    <figure role="img" aria-label={ariaLabel} className="m-0 flex w-full min-w-0 flex-col items-center gap-3">
      <div aria-hidden="true" className="relative aspect-[312/176] w-full max-w-[312px] flex-none">
        <svg viewBox="0 0 312 176" className="absolute inset-0 size-full overflow-visible">
          <path
            d={arcPath(0, 100)}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={zone ? ZONE_TRACK[zone] : "stroke-sunken"}
          />
          {zone && value !== null && value > 0 ? (
            <path d={arcPath(0, value)} fill="none" strokeWidth={STROKE} strokeLinecap="round" className={ZONE_ARC[zone]} />
          ) : null}
          {needle ? (
            <>
              <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} strokeWidth={4} strokeLinecap="round" className="stroke-text" />
              <circle cx={CX} cy={CY} r={9} strokeWidth={2} className="fill-text stroke-surface" />
            </>
          ) : null}
        </svg>
        {TICKS.map((tick) => {
          const at = point(tick, R + STROKE / 2 + 16);
          return (
            <span
              key={tick}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-text-subtle tabular-nums"
              style={{ left: `${(at.x / 312) * 100}%`, top: `${(at.y / 176) * 100}%` }}
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
      {stats && stats.length > 0 ? (
        <div className="mt-1 grid w-full grid-cols-2 gap-3 border-t border-border pt-4">
          {stats.map((stat) => (
            <div key={stat.key} className="flex min-w-0 items-center gap-2.5">
              <span
                className={cx(
                  "inline-flex size-8 flex-none items-center justify-center rounded-full",
                  TONE_SOFT[stat.tone],
                )}
              >
                {stat.icon}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="whitespace-nowrap text-base font-bold text-text">{stat.value}</span>
                <span className="truncate text-xs text-text-muted">{stat.label}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </figure>
  );
};

/** «Yaxshi · 70% va undan yuqori» kabi zona badge'i. */
export const ZoneBadge = ({ tone, children }: { tone: Tone; children: ReactNode }) => <Badge tone={tone}>{children}</Badge>;
