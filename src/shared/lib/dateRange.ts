export type DateRangePreset = "today" | "week" | "month" | "all";

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

export const getTodayRange = (): ISODateRange => {
  const now = new Date();
  const today = toISODate(now);

  return { from: today, to: today };
};

export const getThisWeekRange = (): ISODateRange => {
  const now = new Date();
  const weekStartOffset = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const from = new Date(now);
  from.setDate(now.getDate() - weekStartOffset);

  return { from: toISODate(from), to: toISODate(now) };
};

export const getThisMonthRange = (): ISODateRange => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);

  return { from: toISODate(from), to: toISODate(now) };
};

export const getAllTimeRange = (): ISODateRange => ({
  from: "1970-01-01",
  to: toISODate(new Date()),
});

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

  return getTodayRange();
};

export const toApiDateTimeRange = ({ from, to }: Partial<ISODateRange>) => ({
  from: from ? `${from}T00:00:00` : undefined,
  to: to ? `${to}T23:59:59` : undefined,
});
