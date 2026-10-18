// dizayn-v2: tizim-charts
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { CHART_FILL, type ChartTone } from "./tone";

export interface ChartLegendItem {
  key: string;
  label: ReactNode;
  tone: ChartTone;
  /** Chiziq belgisi (trend seriyasi) — `h-0.5 w-4`. */
  line?: boolean;
  /** Belgi shakli: `square` (sukut, `.el-legend-key`), `dot`, `target` (maqsad chizig'i `|`). `line` ustun. */
  shape?: "square" | "dot" | "target";
  /** Belgi rangini almashtirish (masalan `bg-chart-1`, `bg-chart-muted`) — ton o'rniga. */
  keyClassName?: string;
}

const KEY_SHAPE = {
  square: "size-2.5 rounded-[3px]",
  dot: "size-2.5 rounded-full",
  target: "h-3 w-0.5 rounded-full",
  line: "h-0.5 w-4 rounded-full",
} as const;

/** Legenda belgisi (rangli kvadrat / nuqta / chiziq) — matn emas, bezak. */
export const LegendKey = ({
  tone,
  shape = "square",
  className,
}: {
  tone: ChartTone;
  shape?: keyof typeof KEY_SHAPE;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cx("inline-block shrink-0", KEY_SHAPE[shape], className ?? (shape === "target" ? "bg-text" : CHART_FILL[tone]))}
  />
);

/** LEGENDA (`.el-legend`): grafik ostidagi seriya nomlari — matn rangi doim matn tokenida. */
export const ChartLegend = ({ items, className }: { items: ChartLegendItem[]; className?: string }) => (
  <ul className={cx("m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[13px] text-text-muted", className)}>
    {items.map((item) => (
      <li key={item.key} className="inline-flex min-w-0 items-center gap-2">
        <LegendKey tone={item.tone} shape={item.line ? "line" : (item.shape ?? "square")} className={item.keyClassName} />
        <span className="min-w-0">{item.label}</span>
      </li>
    ))}
  </ul>
);

/** IZOH (`.el-chart-note`): ⓘ + kichik matn — grafik qanday o'qilishi, ma'lumot cheklovi. */
export const ChartNote = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx("m-0 flex items-start gap-2 text-xs leading-[18px] text-text-subtle", className)}>
    <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
    <span className="min-w-0">{children}</span>
  </p>
);
