// dizayn-v2: tizim-charts
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { Badge, Button } from "../primitives";
import { CHART_FILL, type ChartTone } from "./tone";

export interface HBarRow {
  id: string;
  label: string;
  /** Chiziq uzunligi shu qiymatdan (eng kattasiga nisbatan). */
  value: number;
  /** Chiziq yonidagi qalin matn: «81,6%», «24 ta». */
  display: string;
  /** Sukut `action`. */
  tone?: ChartTone;
  /** Nom yonidagi badge: «Siz». */
  badge?: string;
  /** Qalin matndan keyingi oddiy izoh: «31 / 38 ta», «4,8 mln so'm». */
  sub?: string;
}

export interface HBarListProps {
  rows: HBarRow[];
  ariaLabel: string;
  /** Yig'iq holatdagi qatorlar (sukut — hammasi). */
  limit?: number;
  /** Telefonda (< 768) yig'iq holatdagi qatorlar (sukut — `limit`). */
  mobileLimit?: number;
  expandable?: boolean;
  /** Shkala maksimumi (sukut — eng katta qiymat; foizda 100 bering). */
  max?: number;
  className?: string;
}

/**
 * GORIZONTAL USTUNLAR (`.el-hbars`, `.el-hbar`): nom · chiziq + «qiymat · izoh». Uzun nomlar uchun
 * (marketlar, filiallar). Oddiy div (recharts emas). Ro'yxat — grafikning o'zi jadval tuzilmasida.
 */
export const HBarList = ({ rows, ariaLabel, limit, mobileLimit, expandable = false, max, className }: HBarListProps) => {
  const { t } = useTranslation("dashboard");
  const [expanded, setExpanded] = useState(false);
  const scaleMax = max ?? Math.max(0, ...rows.map((row) => row.value));
  const visible = expanded || limit == null ? rows : rows.slice(0, limit);
  const phoneLimit = Math.min(mobileLimit ?? limit ?? rows.length, limit ?? rows.length);
  const more = limit == null ? 0 : Math.max(0, rows.length - limit);
  const morePhone = Math.max(0, rows.length - phoneLimit);
  return (
    <div className={cx("flex min-w-0 flex-col gap-3", className)}>
      <ul aria-label={ariaLabel} className="m-0 flex min-w-0 list-none flex-col gap-2 p-0">
        {visible.map((row, index) => {
          const width = scaleMax > 0 ? Math.max(0, Math.min(100, (row.value / scaleMax) * 100)) : 0;
          return (
            <li
              key={row.id}
              data-hbar-row=""
              className={cx(
                "grid min-h-6 grid-cols-[minmax(80px,32%)_minmax(0,1fr)] items-center gap-3 text-[13px] max-md:grid-cols-1 max-md:gap-1",
                !expanded && index >= phoneLimit && "max-md:hidden",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={cx("truncate text-text", row.badge && "font-semibold")}>{row.label}</span>
                {row.badge ? (
                  <Badge size="sm" tone="info" className="shrink-0">
                    {row.badge}
                  </Badge>
                ) : null}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cx("block h-4 min-w-0.5 flex-none rounded-r-[4px]", CHART_FILL[row.tone ?? "action"])}
                  style={{ width: `calc((100% - 9rem) * ${(width / 100).toFixed(4)})` }}
                />
                <span className="whitespace-nowrap font-semibold text-text">
                  {row.display}
                  {row.sub ? <span className="font-normal text-text-muted"> · {row.sub}</span> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {expandable && (expanded || morePhone > 0) ? (
        <Button
          variant="ghost"
          size="sm"
          className={cx("self-center", !expanded && more === 0 && "md:hidden")}
          aria-expanded={expanded}
          rightIcon={expanded ? ChevronUp : ChevronDown}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            t("v2Charts.showLess")
          ) : (
            <>
              <span className="max-md:hidden">{t("v2Charts.showMore", { count: more })}</span>
              <span className="md:hidden">{t("v2Charts.showMore", { count: morePhone })}</span>
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
};
