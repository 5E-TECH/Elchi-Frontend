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
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Ikonka */}
            <Calendar
                size={size === "sm" ? 13 : 14}
                className={iconClassName ?? "text-gray-400 dark:text-white/50 shrink-0"}
            />

            {/* Boshlanish sanasi */}
            <CustomDatePicker
                value={dateFrom}
                onChange={onChangeDateFrom}
                placeholder="Boshlanish"
                maxDate={dateTo || undefined}
                className={fromClassName ?? "w-40"}
                size={size}
            />

            {/* Ajratuvchi */}
            <span className="text-gray-300 dark:text-white/20 text-sm select-none">—</span>

            {/* Tugash sanasi */}
            <CustomDatePicker
                value={dateTo}
                onChange={onChangeDateTo}
                placeholder="Tugash"
                minDate={dateFrom || undefined}
                className={toClassName ?? "w-40"}
                size={size}
            />
        </div>
    );
});

FilterDateRange.displayName = "FilterDateRange";

export default FilterDateRange;
