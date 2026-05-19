import { memo, useMemo } from "react";
import DateRangePicker from "./DateRangePicker";
import FilterClearButton from "./FilterClearButton";
import {
  getPresetDateRange,
  parseISODate,
  toISODate,
  type DateRangePreset,
  type ISODateRange,
} from "../lib/dateRange";

const defaultLabels: Record<DateRangePreset, string> = {
  today: "Bugun",
  week: "Shu hafta",
  month: "Shu oy",
};

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
}

const QuickDateRangeFilter = ({
  fromDate,
  toDate,
  onChange,
  onClear,
  labels,
  placeholder = "Dan → Gacha",
  className = "",
  pickerClassName = "",
  clearClassName = "",
  size = "md",
  showPicker = true,
}: QuickDateRangeFilterProps) => {
  const ranges = useMemo(
    () => ({
      today: getPresetDateRange("today"),
      week: getPresetDateRange("week"),
      month: getPresetDateRange("month"),
    }),
    [],
  );

  const activeQuick = useMemo(() => {
    if (fromDate === ranges.today.from && toDate === ranges.today.to) return "today";
    if (fromDate === ranges.week.from && toDate === ranges.week.to) return "week";
    if (fromDate === ranges.month.from && toDate === ranges.month.to) return "month";
    return null;
  }, [fromDate, ranges, toDate]);

  const hasDateFilter = Boolean(fromDate || toDate);

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-1.5">
        {(["today", "week", "month"] as const).map((key) => {
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
            placeholder={placeholder}
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
