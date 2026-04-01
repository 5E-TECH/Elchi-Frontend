import { memo } from "react";
import { Calendar } from "lucide-react";
import CustomDatePicker from "./CustomDatePicker";

interface FilterDateRangeProps {
    dateFrom: string;
    dateTo: string;
    onChangeDateFrom: (value: string) => void;
    onChangeDateTo: (value: string) => void;
    className?: string;
    fromClassName?: string;
    toClassName?: string;
    iconClassName?: string;
    size?: "sm" | "md";
}

const FilterDateRange = memo(({
    dateFrom,
    dateTo,
    onChangeDateFrom,
    onChangeDateTo,
    className = "",
    fromClassName,
    toClassName,
    iconClassName,
    size = "md",
}: FilterDateRangeProps) => {
    return (
        <div className={`flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center ${className}`}>
            {/* Ikonka */}
            <Calendar
                size={size === "sm" ? 13 : 14}
                className={iconClassName ?? "hidden shrink-0 text-gray-400 dark:text-white/50 sm:block"}
            />

            {/* Boshlanish sanasi */}
            <CustomDatePicker
                value={dateFrom}
                onChange={onChangeDateFrom}
                placeholder="Boshlanish"
                maxDate={dateTo || undefined}
                className={fromClassName ?? "w-full sm:w-40"}
                size={size}
            />

            {/* Ajratuvchi */}
            <span className="hidden text-sm select-none text-gray-300 dark:text-white/20 sm:inline">
                —
            </span>

            {/* Tugash sanasi */}
            <CustomDatePicker
                value={dateTo}
                onChange={onChangeDateTo}
                placeholder="Tugash"
                minDate={dateFrom || undefined}
                className={toClassName ?? "w-full sm:w-40"}
                size={size}
            />
        </div>
    );
});

FilterDateRange.displayName = "FilterDateRange";

export default FilterDateRange;
