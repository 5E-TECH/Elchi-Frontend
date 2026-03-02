import { memo } from "react";
import { Calendar } from "lucide-react";
import CustomDatePicker from "./CustomDatePicker";

interface FilterDateRangeProps {
    dateFrom: string;
    dateTo: string;
    onChangeDateFrom: (value: string) => void;
    onChangeDateTo: (value: string) => void;
    className?: string;
}

const FilterDateRange = memo(({
    dateFrom,
    dateTo,
    onChangeDateFrom,
    onChangeDateTo,
    className = "",
}: FilterDateRangeProps) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Ikonka */}
            <Calendar size={14} className="text-gray-400 dark:text-white/30 shrink-0" />

            {/* Boshlanish sanasi */}
            <CustomDatePicker
                value={dateFrom}
                onChange={onChangeDateFrom}
                placeholder="Boshlanish"
                maxDate={dateTo || undefined}
                className="w-40"
            />

            {/* Ajratuvchi */}
            <span className="text-gray-300 dark:text-white/20 text-sm select-none">—</span>

            {/* Tugash sanasi */}
            <CustomDatePicker
                value={dateTo}
                onChange={onChangeDateTo}
                placeholder="Tugash"
                minDate={dateFrom || undefined}
                className="w-40"
            />
        </div>
    );
});

FilterDateRange.displayName = "FilterDateRange";

export default FilterDateRange;
