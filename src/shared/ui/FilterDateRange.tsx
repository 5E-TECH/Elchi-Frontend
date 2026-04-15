import { memo } from "react";
import DateRangePicker from "./DateRangePicker";

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
    size = "md",
}: FilterDateRangeProps) => {
    const parseISODate = (value: string) => {
        if (!value) return null;

        const [year, month, day] = value.split("-").map(Number);
        if (!year || !month || !day) return null;

        return new Date(year, month - 1, day);
    };

    const toISODate = (value: Date | null) => {
        if (!value) return "";

        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    return (
        <DateRangePicker
            value={{
                startDate: parseISODate(dateFrom),
                endDate: parseISODate(dateTo),
            }}
            onChange={({ startDate, endDate }) => {
                onChangeDateFrom(toISODate(startDate));
                onChangeDateTo(toISODate(endDate));
            }}
            className={className}
            size={size}
        />
    );
});

FilterDateRange.displayName = "FilterDateRange";

export default FilterDateRange;
