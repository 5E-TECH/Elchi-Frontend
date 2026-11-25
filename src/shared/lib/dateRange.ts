import { businessToday } from "./businessDay";

export type DateRangePreset = "today" | "week" | "month" | "year" | "all";

export interface ISODateRange {
  from: string;
  to: string;
}

export const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const parseISODate = (value: string) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

/**
 * «Bugun / Hafta / Oy / Yil» — ISH KUNI bo'yicha (xhiXv3w3, `businessDay.ts`): kun 05:00 da almashsa, 01:30 da
 * «Bugun» hali kechagi sana. Soat 00:00 (sukut) — qurilmaning kalendar sanasi, avvalgidek.
 */
const dayKeyShift = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const getTodayRange = (): ISODateRange => {
  const today = businessToday();

  return { from: today, to: today };
};

export const getThisWeekRange = (): ISODateRange => {
  const today = businessToday();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStartOffset = weekday === 0 ? 6 : weekday - 1;

  return { from: dayKeyShift(today, -weekStartOffset), to: today };
};

export const getThisMonthRange = (): ISODateRange => {
  const today = businessToday();

  return { from: `${today.slice(0, 7)}-01`, to: today };
};

export const getThisYearRange = (): ISODateRange => getYearRange(Number(businessToday().slice(0, 4)));

export const getYearRange = (year: number): ISODateRange => {
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31);

  return { from: toISODate(from), to: toISODate(to) };
};

export const getAllTimeRange = (): ISODateRange => ({
  from: "1970-01-01",
  to: businessToday(),
});

/** Inclusive date range immediately preceding the selected range. UTC day math avoids DST shifts. */
export const getPreviousPeriodRange = ({ from, to }: ISODateRange): ISODateRange | null => {
  const parseDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
      ? timestamp
      : null;
  };
  const start = parseDay(from);
  const end = parseDay(to);
  if (start === null || end === null || end < start) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((end - start) / dayMs) + 1;
  return {
    from: new Date(start - days * dayMs).toISOString().slice(0, 10),
    to: new Date(start - dayMs).toISOString().slice(0, 10),
  };
};

export const getPresetDateRange = (preset: DateRangePreset): ISODateRange => {
  if (preset === "all") {
    return getAllTimeRange();
  }
  if (preset === "week") {
    return getThisWeekRange();
  }

  if (preset === "month") {
    return getThisMonthRange();
  }

  if (preset === "year") {
    return getThisYearRange();
  }

  return getTodayRange();
};

export const toApiDateTimeRange = ({ from, to }: Partial<ISODateRange>) => ({
  from: from ? `${from}T00:00:00` : undefined,
  to: to ? `${to}T23:59:59` : undefined,
});
