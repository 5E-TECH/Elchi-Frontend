import { memo, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";
import DateRangePicker from "./DateRangePicker";
import { SegmentedControl } from "./primitives/SegmentedControl";
import {
  getPresetDateRange,
  getYearRange,
  parseISODate,
  toISODate,
  type DateRangePreset,
  type ISODateRange,
} from "../lib/dateRange";

/**
 * Davr filtri (dashboard'lar) — v1 API, ichi dizayn v2 (3-bosqich). Maket: `superadmin-dashboard-main`,
 * `manager-branch-dashboard-main` — segment «Davr» (`Bugun / Bu hafta / Bu oy / Barchasi`, darhol
 * qo'llanadi) + «Yil» ro'yxati + sana oralig'i («Boshlanish → Tugash»).
 *
 * Joylashuv maketdagi `.el-actions` (`flex flex-wrap items-center gap-2`):
 *   planshet/desktop — bitta qator: segment · «Yil» · sana oralig'i (joy yetmasa keyingi qatorga o'tadi);
 *   telefon — segment to'liq enli (har variant ≥ 44 px), ostida «Yil» + sana oralig'i (`pickerClassName`).
 * Sana oralig'i tez tanlovsiz (segment yonida turibdi). Oraliq tanlangan bo'lsa maydondagi × tozalaydi
 * (`onClear`, bo'lmasa bo'sh oraliq).
 *
 * Davrlar `shared/lib/dateRange` dan (sahifalar va testlar shu qiymatlarni kutadi): «Barchasi» —
 * `1970-01-01 … bugun` (maydonda ko'rsatilmaydi — namuna matni qoladi).
 */
interface QuickDateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onChange: (range: ISODateRange) => void;
  /** Maydondagi × bosilganda (berilmasa — `onChange({ from: "", to: "" })`). */
  onClear?: () => void;
  labels?: Partial<Record<DateRangePreset, string>>;
  placeholder?: string;
  className?: string;
  /** «Yil» + sana oralig'i guruhi kengligi, masalan `w-full sm:w-88` (telefonda doim to'liq enli). */
  pickerClassName?: string;
  /** @deprecated v1 alohida «Tozalash» tugmasi — v2 da tozalash maydon ichida (×), e'tiborga olinmaydi. */
  clearClassName?: string;
  /** @deprecated v1 o'lchami — v2 da bitta o'lcham, e'tiborga olinmaydi. */
  size?: "sm" | "md";
  showPicker?: boolean;
  includeAll?: boolean;
}

type QuickKey = "today" | "week" | "month" | "all";

/** Segment hech biriga to'g'ri kelmasa (qo'lda oraliq, yil) — hech qaysi variant tanlanmagan. */
const CUSTOM = "custom";

/**
 * «Yil» — maketdagi `.el-select` ko'rinishidagi tabiiy `<select>` (klaviatura va telefon ro'yxati
 * brauzerniki). Telefonda 16 px (iOS kattalashtirmasin) va 44 px.
 */
const YEAR_SELECT =
  "h-10 w-full cursor-pointer appearance-none rounded-[10px] border border-border-strong bg-input pr-9 pl-3 " +
  "text-base font-medium text-text outline-none! transition-[background-color,border-color,color,box-shadow] " +
  "duration-150 motion-reduce:transition-none hover:border-text-subtle focus-visible:border-action " +
  "focus-visible:ring-3 focus-visible:ring-focus md:text-sm max-md:h-11";

const QuickDateRangeFilter = ({
  fromDate,
  toDate,
  onChange,
  onClear,
  labels,
  placeholder,
  className = "",
  pickerClassName = "",
  showPicker = true,
  includeAll = false,
}: QuickDateRangeFilterProps) => {
  const { t } = useTranslation("common");
  const { t: tUi } = useTranslation("ui");
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

  const activeQuick = useMemo<QuickKey | null>(() => {
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

  // Sukut yorliqlar maketdagidek («Bugun / Bu hafta / Bu oy / Barchasi», «Yil»).
  const defaultLabels = useMemo<Record<DateRangePreset, string>>(
    () => ({
      today: tUi("date.presets.today"),
      week: tUi("date.presets.week"),
      month: tUi("date.presets.month"),
      year: t("thisYear"),
      all: tUi("date.presets.all"),
    }),
    [t, tUi],
  );
  const pickerPlaceholder =
    placeholder ??
    t("dateRangePlaceholder", {
      from: t("from"),
      to: t("to"),
    });

  const keys: QuickKey[] = includeAll ? ["today", "week", "month", "all"] : ["today", "week", "month"];
  const options = keys.map((key) => ({ value: key, label: labels?.[key] ?? defaultLabels[key] }));
  // «Barchasi» (1970 … bugun) maydonda sana bo'lib ko'rinmaydi — namuna matni qoladi.
  const pickerValue =
    activeQuick === "all"
      ? { startDate: null, endDate: null }
      : { startDate: parseISODate(fromDate), endDate: parseISODate(toDate) };

  return (
    <div className={cx("flex w-full min-w-0 flex-wrap items-center gap-2", className)}>
      <SegmentedControl<QuickKey | typeof CUSTOM>
        ariaLabel={tUi("date.periodLabel")}
        options={options}
        value={activeQuick ?? CUSTOM}
        onValueChange={(key) => {
          if (key !== CUSTOM) onChange(ranges[key]);
        }}
      />

      <div className={cx("flex min-w-0 items-center gap-2 max-md:basis-full", pickerClassName)}>
        <div className={cx("relative shrink-0", !showPicker && "w-full")}>
          <select
            aria-label={tUi("date.yearLabel")}
            value={selectedYear}
            onChange={(event) => {
              const year = Number(event.target.value);
              if (year) onChange(getYearRange(year));
            }}
            className={YEAR_SELECT}
          >
            <option value="">{labels?.year ?? defaultLabels.year}</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-subtle"
          />
        </div>

        {showPicker ? (
          <DateRangePicker
            value={pickerValue}
            onChange={({ startDate, endDate }) => {
              if (!startDate && !endDate && onClear) {
                onClear();
                return;
              }
              onChange({
                from: startDate ? toISODate(startDate) : "",
                to: endDate ? toISODate(endDate) : "",
              });
            }}
            placeholder={pickerPlaceholder}
            presets={false}
            className="min-w-0 flex-1"
          />
        ) : null}
      </div>
    </div>
  );
};

export default memo(QuickDateRangeFilter);
