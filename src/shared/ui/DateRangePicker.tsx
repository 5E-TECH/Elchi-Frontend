import { memo } from "react";
import { useTranslation } from "react-i18next";
import { DateRange, type DatePresetKey } from "./primitives/DateRange";
import { isoDayToDate, toISODay } from "./primitives/date/calendarMath";

/**
 * v1 API (`Date` qiymatli sana oralig'i) — ichi dizayn v2 `DateRange` (3-bosqich).
 *
 * Yangi kodda to'g'ridan-to'g'ri `DateRange` (`shared/ui/primitives`) ishlating: qiymati
 * `{ from, to }` satrlari (`"YYYY-MM-DD"`), `Date` ga aylantirish kerak emas. Bu o'ram eski
 * sahifalar (kassa, hududlar, dashboard) o'zgarmasdan ishlashi uchun.
 */
export interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  /** Oraliq tanlandi (`Date` — mahalliy yarim tun); tozalansa / «Barchasi» — ikkalasi `null`. */
  onChange: (range: DateRangeValue) => void;
  /** Bo'sh maydon matni (sukut «Boshlanish → Tugash»). */
  placeholder?: string;
  className?: string;
  /** @deprecated v1 o'lchami: v2 maydon bitta o'lchamda (40 px, telefonda 44 px) — e'tiborga olinmaydi. */
  size?: "sm" | "md";
  /** Tez tanlov chiplari (sukut maketdagi «Bugun / Bu hafta / Bu oy / Barchasi»; `false` — yo'q). */
  presets?: readonly DatePresetKey[] | false;
  /** Maydon nomi (`Field` siz; sukut «Sana oralig'i»). */
  "aria-label"?: string;
}

const toDay = (date: Date | null) => (date && !Number.isNaN(date.getTime()) ? toISODay(date) : "");

const DateRangePicker = ({ value, onChange, placeholder, className = "", presets, "aria-label": ariaLabel }: DateRangePickerProps) => {
  const { t } = useTranslation("common");

  return (
    <DateRange
      value={{ from: toDay(value.startDate), to: toDay(value.endDate) }}
      onChange={({ from, to }) => onChange({ startDate: isoDayToDate(from), endDate: isoDayToDate(to) })}
      placeholder={placeholder ?? `${t("startDate")} → ${t("endDate")}`}
      presets={presets}
      aria-label={ariaLabel}
      className={className}
    />
  );
};

export default memo(DateRangePicker);
