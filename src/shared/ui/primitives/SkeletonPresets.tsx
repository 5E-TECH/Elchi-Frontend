import type { ComponentProps } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { Skeleton, type SkeletonTone } from "./Skeleton";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TAYYOR SKELETLAR — dizayn v2 (taxtalar `tizim-loading` 03/12/13, `tizim-errors` 02 «Yuklanmoqda»,
 *  `tizim-charts` 05 «Yuklanmoqda»; `design/CODE-MAP.md` 2.7 / 2.9)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Skelet haqiqiy kontent shaklida va balandligida: jadval qatori 56 px, sarlavha qatori 40 px, telefon
 *  kartasi ~96 px — ma'lumot kelganda sahifa sakramaydi. `surface` karta ustida — `border` ton (sukut).
 *  Kechikish (400 ms) va «sekin» izoh vaqti — `QueryBoundary` / `useLoadingPhase` da; bu yerda faqat shakl.
 *
 *    SkeletonLines  — matn qatorlari (60% · 100% · 80%);
 *    SkeletonTable  — jadval (≥ 768) / kartalar ro'yxati (< 768), ixtiyoriy haqiqiy ustun nomlari;
 *    SkeletonList   — telefon kartalari ro'yxati (yoki kartali ro'yxat);
 *    SkeletonChart  — grafik ustunlari (`.el-chart-loading`);
 *    SlowLoadingHint — «Kutish uzoq davom etmoqda — internet sekin bo'lishi mumkin» (`role="status"`).
 */

/** «Sekin» izohi (15 s dan keyin). `variant="foot"` — karta pastki qatori ko'rinishida (chiziq bilan). */
export const SlowLoadingHint = ({
  variant = "inline",
  className,
  ...rest
}: Omit<ComponentProps<"p">, "children"> & { variant?: "inline" | "foot" }) => {
  const { t } = useTranslation("ui");
  return (
    <p
      role="status"
      className={cx(
        "m-0 flex items-center justify-center gap-2 text-center text-[13px] text-text-muted",
        variant === "foot" ? "border-t border-border px-5 py-3" : "pt-3",
        className,
      )}
      {...rest}
    >
      <Clock aria-hidden="true" focusable="false" size={16} strokeWidth={2} className="shrink-0" />
      {t("states.slow")}
    </p>
  );
};

const LINE_WIDTHS = ["60%", "100%", "80%"] as const;

export type SkeletonLinesProps = Omit<ComponentProps<"div">, "children"> & {
  lines?: number;
  tone?: SkeletonTone;
};

/** Matn qatorlari skeleti (taxta: «Skelet — 400 ms dan»). */
export const SkeletonLines = ({ lines = 3, tone = "border", className, ...rest }: SkeletonLinesProps) => (
  <div data-skeleton-preset="lines" className={cx("flex min-w-0 flex-col gap-2", className)} {...rest}>
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton key={index} tone={tone} width={LINE_WIDTHS[index % LINE_WIDTHS.length]} />
    ))}
  </div>
);

/** Telefon kartasidagi kenglik naqshlari (maket: `tizim-errors` → `.el-show-mobile` ro'yxati). */
const CARD_WIDTHS = [
  [128, 88, 180, 72, 68],
  [112, 96, 196, 96, 84],
  [136, 80, 168, 56, 68],
] as const;

export type SkeletonListProps = Omit<ComponentProps<"div">, "children"> & {
  /** Kartalar soni (taxta: telefonda 5 ta). */
  rows?: number;
  tone?: SkeletonTone;
};

/** Kartalar ro'yxati skeleti: sarlavha + summa, bir qator izoh, ikki badge. */
export const SkeletonList = ({ rows = 5, tone = "border", className, ...rest }: SkeletonListProps) => (
  <div data-skeleton-preset="list" className={cx("flex min-w-0 flex-col", className)} {...rest}>
    {Array.from({ length: rows }, (_, index) => {
      const [title, amount, meta, badgeA, badgeB] = CARD_WIDTHS[index % CARD_WIDTHS.length];
      return (
        <div key={index} className="flex min-w-0 flex-col gap-2.5 border-b border-border px-4 py-3.5 last:border-b-0">
          <div className="flex justify-between gap-3">
            <Skeleton tone={tone} width={title} height={14} />
            <Skeleton tone={tone} width={amount} height={14} />
          </div>
          <Skeleton tone={tone} width={meta} height={10} className="max-w-full" />
          <div className="flex gap-1.5">
            <Skeleton tone={tone} width={badgeA} height={24} />
            <Skeleton tone={tone} width={badgeB} height={24} />
          </div>
        </div>
      );
    })}
  </div>
);

/** Ustun turi bo'yicha katak skeleti (maket: buyurtma, mijoz, hudud — 2 qator; market; holat badge; summa). */
type CellKind = "double" | "single" | "pill" | "num";
const CELL_PATTERN: readonly CellKind[] = ["double", "double", "double", "single", "pill", "pill", "num"];
const CELL_WIDTHS: Record<CellKind, readonly (readonly [number, number])[]> = {
  double: [
    [64, 108],
    [124, 112],
    [116, 76],
    [104, 112],
    [128, 76],
  ],
  single: [[88, 0], [104, 0], [72, 0]],
  pill: [[72, 0], [96, 0], [56, 0], [68, 0]],
  num: [[92, 0], [76, 0], [104, 0]],
};

const kindOf = (column: number, total: number): CellKind => {
  if (column === total - 1 && total > 1) return "num";
  return CELL_PATTERN[Math.min(column, CELL_PATTERN.length - 2)] ?? "single";
};

const Cell = ({ kind, row, column, tone }: { kind: CellKind; row: number; column: number; tone: SkeletonTone }) => {
  const widths = CELL_WIDTHS[kind];
  const [first, second] = widths[(row + column) % widths.length];
  if (kind === "double") {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton tone={tone} width={first} className="max-w-full" />
        <Skeleton tone={tone} width={second} height={10} className="max-w-full" />
      </div>
    );
  }
  if (kind === "pill") return <Skeleton tone={tone} width={first} height={24} className="max-w-full" />;
  return <Skeleton tone={tone} width={first} className={cx("max-w-full", kind === "num" && "ml-auto")} />;
};

export type SkeletonTableProps = Omit<ComponentProps<"div">, "children"> & {
  /** Jadval qatorlari (taxta: 8). */
  rows?: number;
  /** Ustunlar soni yoki haqiqiy ustun nomlari (nomlar darhol ko'rinadi — taxta: «ustun nomlari ishlaydi»). */
  columns?: number | readonly string[];
  /** Telefondagi kartalar (taxta: 5). */
  mobileRows?: number;
  /** O'z kartasi bilan (sukut). Karta ichida — `false`. */
  framed?: boolean;
  /** Pastda «Kutish uzoq davom etmoqda…» (15 s dan keyin beriladi). */
  slow?: boolean;
  tone?: SkeletonTone;
};

/**
 * Jadval skeleti: sarlavha qatori 40 px (`sunken`), qatorlar 56 px; telefonda — kartalar ro'yxati.
 *
 *   <SkeletonTable columns={[t("orders.order"), t("orders.customer"), …]} />
 */
export const SkeletonTable = ({
  rows = 8,
  columns = 7,
  mobileRows = 5,
  framed = true,
  slow = false,
  tone = "border",
  className,
  ...rest
}: SkeletonTableProps) => {
  const titles = typeof columns === "number" ? null : columns;
  const count = Math.max(1, typeof columns === "number" ? columns : columns.length);
  const grid = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` };

  return (
    <div
      data-skeleton-preset="table"
      className={cx("min-w-0 overflow-hidden", framed && "rounded-[14px] border border-border bg-surface", className)}
      {...rest}
    >
      <div className="max-md:hidden">
        <div className="grid h-10 items-center gap-4 border-b border-border bg-sunken px-4" style={grid}>
          {Array.from({ length: count }, (_, column) =>
            titles ? (
              <span
                key={column}
                className={cx(
                  "truncate text-xs font-semibold uppercase tracking-[.04em] text-text-muted",
                  column === count - 1 && count > 1 && "text-right",
                )}
              >
                {titles[column]}
              </span>
            ) : (
              <Skeleton
                key={column}
                tone={tone}
                width={column % 2 === 0 ? 72 : 56}
                className={cx("max-w-full", column === count - 1 && count > 1 && "ml-auto")}
              />
            ),
          )}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid h-14 items-center gap-4 border-b border-border px-4 last:border-b-0"
            style={grid}
          >
            {Array.from({ length: count }, (_, column) => (
              <Cell key={column} kind={kindOf(column, count)} row={row} column={column} tone={tone} />
            ))}
          </div>
        ))}
      </div>
      <SkeletonList rows={mobileRows} tone={tone} className="hidden max-md:flex" />
      {slow ? <SlowLoadingHint variant="foot" /> : null}
    </div>
  );
};

const BAR_HEIGHTS = ["46%", "62%", "38%", "70%", "55%", "66%", "48%", "74%"] as const;

export type SkeletonChartProps = Omit<ComponentProps<"div">, "children"> & {
  /** Ustunlar soni (sukut 8). */
  bars?: number;
};

/**
 * Grafik skeleti (`.el-chart-loading`): ustunlar ≤ 24 px, `border` rangida, pastda asos chizig'i.
 * Balandlik qat'iy 200 px (maketda `min-height`): foizli ustun balandligi aniq balandlikka tayanadi.
 */
export const SkeletonChart = ({ bars = 8, className, ...rest }: SkeletonChartProps) => (
  <div
    data-skeleton-preset="chart"
    className={cx(
      "relative flex h-[200px] min-w-0 items-end gap-3 overflow-hidden border-b border-border px-4 pt-4",
      className,
    )}
    {...rest}
  >
    {Array.from({ length: bars }, (_, index) => (
      <Skeleton
        key={index}
        shape="block"
        tone="border"
        height={BAR_HEIGHTS[index % BAR_HEIGHTS.length]}
        className="max-w-6 flex-1 rounded-t rounded-b-none"
      />
    ))}
  </div>
);
