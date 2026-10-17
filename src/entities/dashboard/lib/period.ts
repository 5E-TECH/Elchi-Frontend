import type { TFunction } from "i18next";
import {
  getAllTimeRange,
  getPreviousPeriodRange,
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
  type ISODateRange,
} from "../../../shared/lib/dateRange";
import { resolveMoneyLanguage, CURRENCY_LABEL, formatCompactMoneyLocalized } from "../../../shared/lib/formatMoney";

/**
 * DASHBOARD DAVRI — sarlavha, grafik izohlari va oldingi davr solishtiruvi uchun umumiy hisob.
 *
 * Davr redux'da (`filter.dashboardFromDate/ToDate`) saqlanadi; bo'sh oraliq = bugun (backend ham shunday).
 * «Barchasi» = `getAllTimeRange()` (1970 … bugun).
 */
export type DashboardPeriodKind = "today" | "week" | "month" | "year" | "all" | "custom";

export interface DashboardPeriod {
  kind: DashboardPeriodKind;
  /** Bo'sh oraliq bo'lsa — bugun. */
  range: ISODateRange;
  /** Yil tanlangan bo'lsa. */
  year?: number;
}

const YEAR_RE = /^(\d{4})-01-01$/;

export const resolveDashboardPeriod = (fromDate: string, toDate: string): DashboardPeriod => {
  const today = getTodayRange();
  if (!fromDate || !toDate) return { kind: "today", range: today };
  const range = { from: fromDate, to: toDate };
  const all = getAllTimeRange();
  if (fromDate === all.from && toDate === all.to) return { kind: "all", range };
  if (fromDate === today.from && toDate === today.to) return { kind: "today", range };
  const week = getThisWeekRange();
  if (fromDate === week.from && toDate === week.to) return { kind: "week", range };
  const month = getThisMonthRange();
  if (fromDate === month.from && toDate === month.to) return { kind: "month", range };
  const yearMatch = YEAR_RE.exec(fromDate);
  if (yearMatch && toDate === `${yearMatch[1]}-12-31`) return { kind: "year", range, year: Number(yearMatch[1]) };
  return { kind: "custom", range };
};

/** «25.09» (yilsiz) yoki «25.09.2026». Satr ustida — sana formatlovchisi kerak emas (ISO kun). */
const dayMonth = (iso: string, withYear = false) => {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return withYear ? `${day}.${month}.${year}` : `${day}.${month}`;
};

/** «25.09 – 08.10», bir kun — «08.10.2026», turli yillar — «28.12.2025 – 05.01.2026». */
export const formatShortRange = ({ from, to }: ISODateRange): string => {
  if (!from || !to) return "";
  if (from === to) return dayMonth(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return sameYear ? `${dayMonth(from)} – ${dayMonth(to)}` : `${dayMonth(from, true)} – ${dayMonth(to, true)}`;
};

/** Davr nomi: «Bugun», «Bu hafta», «Bu oy», «Barcha davr», «2025 yil», «01.10 – 08.10». */
export const periodLabel = (t: TFunction, period: DashboardPeriod): string => {
  switch (period.kind) {
    case "today":
      return t("dashboard:v2Dashboard.period.today");
    case "week":
      return t("dashboard:v2Dashboard.period.week");
    case "month":
      return t("dashboard:v2Dashboard.period.month");
    case "all":
      return t("dashboard:v2Dashboard.period.all");
    case "year":
      return t("dashboard:v2Dashboard.period.year", { year: period.year });
    default:
      return formatShortRange(period.range);
  }
};

/** Sarlavha ostidagi birinchi bo'lak: «Bugungi ko'rsatkichlar» / «Tanlangan davr …» / «Barcha davr …». */
export const periodHeadline = (t: TFunction, period: DashboardPeriod): string => {
  if (period.kind === "all") return t("dashboard:v2Dashboard.headline.all");
  if (period.kind === "today") return t("dashboard:v2Dashboard.headline.today");
  return t("dashboard:v2Dashboard.headline.filtered");
};

/** Oldingi teng davr («Barchasi»da yo'q): bugun → kecha, hafta → oldingi 7 kun … */
export const previousPeriodRange = (period: DashboardPeriod): ISODateRange | null =>
  period.kind === "all" ? null : getPreviousPeriodRange(period.range);

/** Delta izohi: bugun — «kechaga nisbatan», qolgani — «oldingi davrga nisbatan». */
export const comparisonHint = (t: TFunction, period: DashboardPeriod): string =>
  period.kind === "today" ? t("dashboard:v2Dashboard.vsYesterday") : t("dashboard:v2Dashboard.vsPrevious");

/** Oldingi davr markeri nomi: «Kecha» yoki «Oldingi davr». */
export const previousLabel = (t: TFunction, period: DashboardPeriod): string =>
  period.kind === "today" ? t("dashboard:v2Dashboard.yesterday") : t("dashboard:v2Dashboard.previousPeriod");

/** Kunlar soni (ikkala chekka kiradi). */
export const rangeDays = ({ from, to }: ISODateRange): number => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
};

/** Foiz o'zgarishi; asos 0 yoki yo'q bo'lsa — `null` (delta chizilmaydi). */
export const percentChange = (current: number | null | undefined, previous: number | null | undefined): number | null => {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

/** Ulush (0..100), jami 0 bo'lsa 0. */
export const share = (part: number, total: number): number => (total > 0 ? (part / total) * 100 : 0);

/**
 * Ixcham pul StatCard uchun ikki bo'lakka: `48 600 000` → `{ value: "48,6", unit: "mln so'm" }`
 * (maket `.el-kpi-value` + `.el-kpi-unit`); en — `{ value: "48.6M", unit: "UZS" }`.
 */
export const splitCompactMoney = (amount: number, language?: string): { value: string; unit: string } => {
  const lang = resolveMoneyLanguage(language);
  const currency = CURRENCY_LABEL[lang];
  const compact = formatCompactMoneyLocalized(amount, { language: lang, withCurrency: false });
  if (lang === "en") return { value: compact, unit: currency };
  const space = compact.lastIndexOf(" ");
  const suffix = space > 0 ? compact.slice(space + 1) : "";
  if (suffix && /^[^\d−]/.test(suffix)) {
    return { value: compact.slice(0, space), unit: `${suffix} ${currency}` };
  }
  return { value: compact, unit: currency };
};
