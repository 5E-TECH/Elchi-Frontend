import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DateRangePicker from "./DateRangePicker";
import FilterClearButton from "./FilterClearButton";
import {
  getPresetDateRange,
  getYearRange,
  parseISODate,
  toISODate,
  type DateRangePreset,
  type ISODateRange,
} from "../lib/dateRange";

interface QuickDateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onChange: (range: ISODateRange) => void;
  onClear?: () => void;
  labels?: Partial<Record<DateRangePreset, string>>;
  placeholder?: string;
  className?: string;
  pickerClassName?: string;
  clearClassName?: string;
  size?: "sm" | "md";
  showPicker?: boolean;
  includeAll?: boolean;
}

const QuickDateRangeFilter = ({
  fromDate,
  toDate,
  onChange,
  onClear,
  labels,
  placeholder,
  className = "",
  pickerClassName = "",
  clearClassName = "",
  size = "md",
  showPicker = true,
  includeAll = false,
}: QuickDateRangeFilterProps) => {
  const { t } = useTranslation("common");
  const ranges = useMemo(
    () => ({
      today: getPresetDateRange("today"),
      week: getPresetDateRange("week"),
      month: getPresetDateRange("month"),
      year: getPresetDateRange("year"),
      all: getPresetDateRange("all"),
    }),
    [],
  );

  const activeQuick = useMemo(() => {
    if (fromDate === ranges.today.from && toDate === ranges.today.to) return "today";
    if (fromDate === ranges.week.from && toDate === ranges.week.to) return "week";
    if (fromDate === ranges.month.from && toDate === ranges.month.to) return "month";
    if (fromDate === ranges.all.from && toDate === ranges.all.to) return "all";
    return null;
  }, [fromDate, ranges, toDate]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => currentYear - index);
  }, []);

  const selectedYear = useMemo(() => {
    const match = /^(\d{4})-01-01$/.exec(fromDate);
    if (!match) return "";

    const year = Number(match[1]);
    return toDate === `${year}-12-31` ? String(year) : "";
  }, [fromDate, toDate]);

  const hasDateFilter = Boolean(fromDate || toDate);
  const defaultLabels = useMemo<Record<DateRangePreset, string>>(
    () => ({
      today: t("today"),
      week: t("thisWeek"),
      month: t("thisMonth"),
      year: t("thisYear"),
      all: t("all"),
    }),
    [t],
  );
  const pickerPlaceholder =
    placeholder ??
    t("dateRangePlaceholder", {
      from: t("from"),
      to: t("to"),
    });

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-1.5">
        {(["today", "week", "month", ...(includeAll ? ["all" as const] : [])] as const).map((key) => {
          const isActive = activeQuick === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(ranges[key])}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-main text-white shadow-[0_8px_18px_rgba(87,106,219,0.24)]"
                  : "el-glass-control text-maindark/70 hover:text-main dark:text-primary/70 dark:hover:text-primary"
              }`}
            >
              {labels?.[key] ?? defaultLabels[key]}
            </button>
          );
        })}
        <select
          value={selectedYear}
          onChange={(event) => {
            const year = Number(event.target.value);
            if (year) onChange(getYearRange(year));
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold outline-none transition-all ${
            selectedYear
              ? "border-main bg-main text-white shadow-[0_8px_18px_rgba(87,106,219,0.24)]"
              : "el-glass-control border-transparent text-maindark/70 hover:text-main dark:text-primary/70 dark:hover:text-primary"
          }`}
        >
          <option value="">{labels?.year ?? defaultLabels.year}</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {showPicker ? (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <DateRangePicker
            value={{
              startDate: parseISODate(fromDate),
              endDate: parseISODate(toDate),
            }}
            onChange={({ startDate, endDate }) => {
              onChange({
                from: startDate ? toISODate(startDate) : "",
                to: endDate ? toISODate(endDate) : "",
              });
            }}
            placeholder={pickerPlaceholder}
            className={pickerClassName}
            size={size}
          />
          {hasDateFilter && onClear ? (
            <FilterClearButton onClick={onClear} className={clearClassName} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default memo(QuickDateRangeFilter);
