// dizayn-v2: tizim-charts
/**
 * DIZAYN v2 GRAFIK BO'LAKLARI — yagona import nuqtasi (taxta `tizim-charts`, oltin sahifa
 * `superadmin-dashboard-main`, klasslar `design/CODE-MAP.md` §2.9).
 *
 *   import { Gauge, Donut, RankList } from "../../shared/ui/charts";
 *
 * Hammasi oddiy SVG/div + tokenlar (recharts EMAS — dashboard birinchi ochilish byudjeti).
 * recharts faqat trend grafigida va alohida lazy chunk'da. Faqat nomli eksport; o'zgarish faqat additiv.
 * Matnlar — `dashboard:v2Charts.*` (komponent o'zi o'qiydi).
 */

export { CHART_FILL, CHART_SOFT, CHART_SOFT_STROKE, CHART_STROKE, CHART_TRACK, clampPercent, successZoneTone } from "./tone";
export type { ChartTone } from "./tone";

export { Gauge } from "./Gauge";
export type { GaugeProps, GaugeStat } from "./Gauge";

export { Donut } from "./Donut";
export type { DonutProps, DonutSegment } from "./Donut";

export { RankList } from "./RankList";
export type { RankItem, RankListProps } from "./RankList";

export { Meter } from "./Meter";
export type { MeterProps } from "./Meter";

export { SegBar } from "./SegBar";
export type { SegBarProps, SegBarSegment } from "./SegBar";

export { HBarList } from "./HBarList";
export type { HBarListProps, HBarRow } from "./HBarList";

export { Waterfall } from "./Waterfall";
export type { WaterfallProps, WaterfallStep } from "./Waterfall";

export { RingStat } from "./RingStat";
export type { RingStatProps } from "./RingStat";

export { ChartLegend, ChartNote, LegendKey } from "./ChartLegend";
export type { ChartLegendItem } from "./ChartLegend";

export { ViewToggle } from "./ViewToggle";
export type { ChartView, ViewToggleProps } from "./ViewToggle";

export { DeltaChip } from "./DeltaChip";

// DwrMygfo: KPI kartasi ostidagi 14 kunlik chiziq (bosh sahifa, filial ko'rsatkichlari).
export { Sparkline } from "./Sparkline";
export type { DeltaChipProps } from "./DeltaChip";

// IN-1: steklangan ustunlar (investor «Oylik foyda» — To'langan · Kutilmoqda).
export { StackedBars } from "./StackedBars";
export type { StackedBarsColumn, StackedBarsProps, StackedBarsSeries } from "./StackedBars";
