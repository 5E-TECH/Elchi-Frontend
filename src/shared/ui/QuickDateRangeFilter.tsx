import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DateRangePicker from "./DateRangePicker";
import FilterClearButton from "./FilterClearButton";
import {
  getPresetDateRange,
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

  const hasDateFilter = Boolean(fromDate || toDate);
  const defaultLabels = useMemo<Record<DateRangePreset, string>>(
    () => ({
      today: t("today"),
      week: t("thisWeek"),
      month: t("thisMonth"),
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
