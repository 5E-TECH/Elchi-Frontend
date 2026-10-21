// dizayn-v2: tizim-charts
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatCompactMoneyLocalized, formatMoneyLocalized } from "../../lib/formatMoney";
import { niceCeiling } from "./scale";
import { CHART_FILL, type ChartTone } from "./tone";

export interface StackedBarsSeries {
  key: string;
  /** Tooltip va legenda nomi: «To'langan». */
  label: string;
  tone: ChartTone;
}

export interface StackedBarsColumn {
  key: string;
  /** O'q yorlig'i (qisqa): «Sen». */
  label: string;
  /** Tooltip sarlavhasi: «Sentabr 2026». Sukut — `label`. */
  title?: string;
  /** Seriya kaliti → qiymat. Manfiy va `NaN` — 0 (ustun faqat yuqoriga o'sadi). */
  values: Record<string, number>;
  /** Joriy davr — yorlig'i qalin (`.el-bars-labels .is-current`). */
  current?: boolean;
}

export interface StackedBarsProps {
  /** Seriyalar PASTDAN TEPAGA tartibida (birinchisi — ustun asosi). */
  series: StackedBarsSeries[];
  columns: StackedBarsColumn[];
  /** Grafik mazmuni bir jumlada (ekran o'quvchi): «Oylik foyda, noyabr 2025 – oktabr 2026: …». */
  ariaLabel: string;
  /** Ustun ustidagi yig'indi (sukut — ixcham pul, valyutasiz: «2,4 mln», «0»). Telefonda yashirin. */
  formatTotal?: (total: number, column: StackedBarsColumn) => string;
  /** Tooltip qiymati (sukut — to'liq pul: «6 200 000 so'm»). */
  formatValue?: (value: number, series: StackedBarsSeries) => string;
  /** Ustun ustidagi yig'indi. Sukut: ustunlar ≤ 12 bo'lsa (24 ta ustunda yorliqlar bir-biriga tegadi). */
  showTotals?: boolean;
  /** Har nechanchi o'q yorlig'i (desktop/planshet). Sukut: ≤ 12 ustun — har biri, ko'p bo'lsa — har ikkinchisi. */
  labelEvery?: number;
  /** Telefonda har nechanchi o'q yorlig'i. Sukut: ≤ 6 — har biri, ≤ 12 — har 3-si, ko'p bo'lsa — har 6-si. */
  phoneLabelEvery?: number;
  className?: string;
}

const safe = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

/** Yorliq ko'rinadimi: oxirgi (joriy) ustundan orqaga sanab, har `step`-chisi. */
const labelVisible = (index: number, count: number, step: number) => (count - 1 - index) % Math.max(1, step) === 0;

const defaultPhoneStep = (count: number) => (count <= 6 ? 1 : count <= 12 ? 3 : 6);

/**
 * STEKLANGAN USTUNLAR (`.el-bars`, `.el-bars-col`, `.el-bars-stack` — maket `investor-dashboard-home`,
 * «Oylik foyda»): har ustunda bir nechta seriya ustma-ust (2px oraliq, eng yuqori bo'lak 4px yumaloq uch),
 * ustida yig'indi, ostida o'q yorlig'i. Oddiy div + tokenlar (recharts emas — dashboard byudjeti).
 *
 *  - Balandlik yaxlit shiftga nisbatan (`niceCeiling`, 1 · 2 · 5 × 10ⁿ). Nol ustun chizilmaydi, yig'indi «0» bo'lib
 *    qoladi (bo'sh oy ko'rinadi).
 *  - Sichqoncha ustun ustiga kelganda — tooltip (`RAISED` karta: sarlavha, har seriya qiymati); planshetda teginish
 *    tooltip'ni ochadi/yopadi (barmoq ko'tarilganda yopilmaydi). Telefonda tooltip va yig'indilar yashirin, o'q
 *    yorliqlari siyrak (maket). Klaviatura va ekran o'quvchi uchun ma'lumot
 *    `ariaLabel` da va «Grafik | Jadval» egizagida (`ViewToggle` + `DataTable`) — grafik o'zi `role="img"`.
 */
export const StackedBars = ({
  series,
  columns,
  ariaLabel,
  formatTotal,
  formatValue,
  showTotals,
  labelEvery,
  phoneLabelEvery,
  className,
}: StackedBarsProps) => {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const [hovered, setHovered] = useState<number | null>(null);

  const count = columns.length;
  const totals = columns.map((column) => series.reduce((sum, item) => sum + safe(column.values[item.key]), 0));
  const max = niceCeiling(Math.max(0, ...totals));
  const withTotals = showTotals ?? count <= 12;
  const step = labelEvery ?? (count <= 12 ? 1 : 2);
  const phoneStep = phoneLabelEvery ?? defaultPhoneStep(count);

  const totalText = (total: number, column: StackedBarsColumn) =>
    formatTotal ? formatTotal(total, column) : formatCompactMoneyLocalized(total, { language, withCurrency: false });
  const valueText = (value: number, item: StackedBarsSeries) =>
    formatValue ? formatValue(value, item) : formatMoneyLocalized(value, { language });

  const tipColumn = hovered != null ? columns[hovered] : null;
  // Tooltip ustunning o'ng yoki chap tomonida (o'ng yarmida — chapga ochiladi), plot chetidan chiqmaydi.
  const tipLeft = hovered != null ? ((hovered + 0.5) / Math.max(1, count)) * 100 : 0;
  const tipToLeft = hovered != null && hovered >= count / 2;

  return (
    <figure className={cx("m-0 flex min-w-0 flex-col gap-2", className)}>
      <div className="relative min-w-0">
        <div
          role="img"
          aria-label={ariaLabel}
          data-stacked-bars=""
          className="relative flex h-[240px] min-w-0 items-stretch gap-1 border-b border-border pt-6 max-md:h-[160px] max-md:pt-2"
          // Teginishda `pointerleave` barmoq ko'tarilishi bilan keladi — tooltip faqat sichqoncha/qalam ketganda yopiladi.
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setHovered(null);
          }}
        >
          {columns.map((column, index) => {
            const total = totals[index];
            const height = max > 0 ? (total / max) * 100 : 0;
            const visible = series.filter((item) => safe(column.values[item.key]) > 0);
            return (
              <div
                key={column.key}
                data-stack-col={column.key}
                data-hover={hovered === index ? "" : undefined}
                className={cx(
                  "relative h-full min-w-0 flex-1 rounded-md transition-[background-color] duration-150 motion-reduce:transition-none",
                  hovered === index && "bg-row-hover",
                )}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") setHovered(index);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") setHovered((current) => (current === index ? null : index));
                }}
              >
                {total > 0 ? (
                  <span
                    data-stack={column.key}
                    className="absolute bottom-0 left-1/2 flex w-[min(24px,70%)] -translate-x-1/2 flex-col-reverse gap-0.5"
                    style={{ height: `${height}%` }}
                  >
                    {visible.map((item, position) => (
                      <span
                        key={item.key}
                        data-stack-part={item.key}
                        className={cx(
                          "block min-h-0.5",
                          CHART_FILL[item.tone],
                          position === visible.length - 1 && "rounded-t-[4px]",
                        )}
                        style={{ flex: `${safe(column.values[item.key])} 1 0` }}
                      />
                    ))}
                  </span>
                ) : null}
                {withTotals ? (
                  <span
                    data-stack-total=""
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-text max-md:hidden"
                    style={{ bottom: `calc(${height}% + 4px)` }}
                  >
                    {totalText(total, column)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {tipColumn ? (
          <div
            aria-hidden="true"
            data-stacked-tip=""
            className={cx(
              "pointer-events-none absolute top-0 z-10 flex flex-col gap-1.5 rounded-xl border border-border bg-raised px-3 py-2.5 shadow-xl max-md:hidden",
              tipToLeft ? "-translate-x-[calc(100%+12px)]" : "translate-x-3",
            )}
            style={{ left: `${tipLeft}%` }}
          >
            <span className="whitespace-nowrap text-xs font-semibold text-text-muted">{tipColumn.title ?? tipColumn.label}</span>
            {series.map((item) => (
              <span key={item.key} className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-[3px]", CHART_FILL[item.tone])} />
                <span className="font-bold text-text">{valueText(safe(tipColumn.values[item.key]), item)}</span>
                <span className="text-text-muted">{item.label}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div aria-hidden="true" className="flex min-w-0 gap-1">
        {columns.map((column, index) => (
          <span
            key={column.key}
            data-axis-label={column.key}
            className={cx(
              "min-w-0 flex-1 whitespace-nowrap text-center text-xs",
              column.current ? "font-semibold text-text" : "text-text-subtle",
              !labelVisible(index, count, step) && "md:invisible",
              !labelVisible(index, count, phoneStep) && "max-md:invisible",
            )}
          >
            {column.label}
          </span>
        ))}
      </div>
    </figure>
  );
};
