import { memo } from "react";
import { useTranslation } from "react-i18next";
import DateRangePicker from "./DateRangePicker";
import { parseISODate, toISODate } from "../lib/dateRange";

interface FilterDateRangeProps {
    dateFrom: string;
    dateTo: string;
    onChangeDateFrom: (value: string) => void;
    onChangeDateTo: (value: string) => void;
    onChangeRange?: (dateFrom: string, dateTo: string) => void;
    className?: string;
    fromClassName?: string;
    toClassName?: string;
    iconClassName?: string;
    size?: "sm" | "md";
    placeholder?: string;
}

const FilterDateRange = memo(({
    dateFrom,
    dateTo,
    onChangeDateFrom,
    onChangeDateTo,
    onChangeRange,
    className = "",
    size = "md",
    placeholder,
}: FilterDateRangeProps) => {
    const { t } = useTranslation("common");

    return (
        <DateRangePicker
            value={{
                startDate: parseISODate(dateFrom),
                endDate: parseISODate(dateTo),
            }}
            onChange={({ startDate, endDate }) => {
                const nextDateFrom = startDate ? toISODate(startDate) : "";
                const nextDateTo = endDate ? toISODate(endDate) : "";

                if (onChangeRange) {
                    onChangeRange(nextDateFrom, nextDateTo);
                    return;
                }

                onChangeDateFrom(nextDateFrom);
                onChangeDateTo(nextDateTo);
            }}
            className={className}
            size={size}
            placeholder={placeholder ?? `${t("startDate")} → ${t("endDate")}`}
        />
    );
});

FilterDateRange.displayName = "FilterDateRange";

export default FilterDateRange;
