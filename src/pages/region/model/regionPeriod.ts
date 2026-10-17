import dayjs from "dayjs";
import { parseISODate } from "../../../shared/lib/dateRange";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";

/** `/regions` davri — URL `period` parametri (o'zgarmagan sxema). */
export type RegionPeriod = "today" | "week" | "month" | "all" | "custom";
export type RegionQuickPeriod = Exclude<RegionPeriod, "custom">;

export const QUICK_PERIODS: readonly RegionQuickPeriod[] = ["today", "week", "month", "all"];

export interface RegionCustomRange {
  start: string;
  end: string;
}

/** URL'dan boshlang'ich davr: `custom` faqat ikkala sana bo'lsa, noma'lum — «Bugun». */
export const parseRegionPeriod = (
  period: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): { period: RegionPeriod; range: RegionCustomRange | null } => {
  const range = startDate && endDate ? { start: startDate, end: endDate } : null;
  if (period === "custom") return range ? { period: "custom", range } : { period: "today", range: null };
  if (period === "today" || period === "week" || period === "month" || period === "all") {
    return { period, range: null };
  }
  return { period: "today", range: null };
};

/**
 * Davr → API sana parametrlari (`startDate`/`endDate`, `YYYY-MM-DD`). Hafta va oy chegaralari `dayjs`
 * (oldingi xulq aynan saqlangan); «Barchasi» — parametrsiz.
 */
export const regionDateParams = (
  period: RegionPeriod,
  range: RegionCustomRange | null,
  now = dayjs(),
): { startDate?: string; endDate?: string } => {
  if (period === "today") {
    return { startDate: now.startOf("day").format("YYYY-MM-DD"), endDate: now.endOf("day").format("YYYY-MM-DD") };
  }
  if (period === "week") {
    return { startDate: now.startOf("week").format("YYYY-MM-DD"), endDate: now.endOf("week").format("YYYY-MM-DD") };
  }
  if (period === "month") {
    return { startDate: now.startOf("month").format("YYYY-MM-DD"), endDate: now.endOf("month").format("YYYY-MM-DD") };
  }
  if (period === "custom" && range) return { startDate: range.start, endDate: range.end };
  return {};
};

/** Maxsus oraliq yorlig'i: «01.10 – 08.10» (bir kun — «08.10.2026»). */
export const customRangeLabel = (range: RegionCustomRange): string => {
  const start = formatDateLocalized(parseISODate(range.start));
  const end = formatDateLocalized(parseISODate(range.end));
  if (start === end) return start;
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
};
