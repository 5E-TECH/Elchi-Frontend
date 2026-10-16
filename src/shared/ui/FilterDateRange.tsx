import { memo } from "react";
import { useTranslation } from "react-i18next";
import { DateRange } from "./primitives/DateRange";

/**
 * v1 API (ro'yxat filtri: `dateFrom` / `dateTo` satrlari) — ichi dizayn v2 `DateRange` (3-bosqich).
 * Yangi kodda to'g'ridan-to'g'ri `DateRange` (`shared/ui/primitives`) ishlating.
 */
interface FilterDateRangeProps {
    dateFrom: string;
    dateTo: string;
    onChangeDateFrom: (value: string) => void;
    onChangeDateTo: (value: string) => void;
    /** Ikkala sana bitta yangilanishda (URL'ga bitta yozuv) — berilsa `onChangeDateFrom/To` chaqirilmaydi. */
    onChangeRange?: (dateFrom: string, dateTo: string) => void;
    className?: string;
    /** @deprecated v1 — v2 da bitta maydon, e'tiborga olinmaydi. */
    fromClassName?: string;
    /** @deprecated v1 — e'tiborga olinmaydi. */
    toClassName?: string;
    /** @deprecated v1 — e'tiborga olinmaydi. */
    iconClassName?: string;
    /** @deprecated v1 o'lchami — v2 maydon bitta o'lchamda, e'tiborga olinmaydi. */
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
    placeholder,
}: FilterDateRangeProps) => {
    const { t } = useTranslation("common");

    return (
        <DateRange
            value={{ from: dateFrom, to: dateTo }}
            onChange={({ from, to }) => {
                if (onChangeRange) {
                    onChangeRange(from, to);
                    return;
                }

                onChangeDateFrom(from);
                onChangeDateTo(to);
            }}
            className={className}
            placeholder={placeholder ?? `${t("startDate")} → ${t("endDate")}`}
        />
    );
});

FilterDateRange.displayName = "FilterDateRange";

export default FilterDateRange;
