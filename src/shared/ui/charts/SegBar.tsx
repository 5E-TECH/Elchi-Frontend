// dizayn-v2: tizim-charts
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../lib/formatMoney";
import { LegendKey } from "./ChartLegend";
import { CHART_FILL, type ChartTone } from "./tone";

export interface SegBarSegment {
  key: string;
  label: string;
  value: number;
  tone: ChartTone;
  /** Legendadagi ikonka (16 px, neytral). */
  icon?: LucideIcon;
}

export interface SegBarProps {
  segments: SegBarSegment[];
  /** Ostida legenda-jadval (nom · ta · %). Sukut `true`. */
  showLegend?: boolean;
  ariaLabel: string;
  className?: string;
}

/**
 * SEGMENT CHIZIQ (`.el-segbar`): ulushlar bir qatorda — `flex h-3 gap-0.5`, bo'laklar `min-w-1`,
 * chetlari `rounded-[4px]`. Legenda — jadval egizagi (son va foiz matn bilan).
 */
export const SegBar = ({ segments, showLegend = true, ariaLabel, className }: SegBarProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const share = (value: number) => (total > 0 ? (Math.max(0, value) / total) * 100 : 0);
  return (
    <div className={cx("flex min-w-0 flex-col gap-3", className)}>
      <div role="img" aria-label={ariaLabel} className="flex h-3 min-w-0 gap-0.5">
        {total > 0 ? (
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                data-segbar-segment={segment.key}
                className={cx("block min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", CHART_FILL[segment.tone])}
                style={{ flex: `${segment.value} 1 0` }}
              />
            ))
        ) : (
          <span className="block flex-1 rounded-[4px] bg-sunken" />
        )}
      </div>
      {showLegend ? (
        <ul className="m-0 flex min-w-0 list-none flex-col p-0">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 border-t border-border py-1.5 text-sm text-text first:border-t-0"
            >
              <LegendKey tone={segment.tone} />
              <span className="flex min-w-0 items-center gap-2">
                {segment.icon ? <segment.icon size={16} aria-hidden="true" className="shrink-0 text-text-muted" /> : null}
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="whitespace-nowrap text-right font-bold">
                {t("v2Charts.countTa", { value: formatNumberLocalized(segment.value, { language }) })}
              </span>
              <span className="whitespace-nowrap text-right text-[13px] text-text-muted">
                {formatPercentLocalized(share(segment.value), { language })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
