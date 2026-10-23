// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, courier-dashboard-home, market-dashboard-home, manager-branch-dashboard-main
import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { getPresetDateRange, getYearRange, type ISODateRange } from "../../../shared/lib/dateRange";
import { DateRange, PageHeader, SegmentedControl, Select } from "../../../shared/ui/primitives";
import { resolveDashboardPeriod } from "../../../entities/dashboard/lib/period";

type QuickKey = "today" | "week" | "month" | "all";
const CUSTOM = "custom";
const QUICK_KEYS: readonly QuickKey[] = ["today", "week", "month", "all"];
const YEAR_COUNT = 6;

export interface DashboardHeaderProps {
  /** Sarlavha ostidagi qator: «Bugungi ko'rsatkichlar · butun kompaniya bo'yicha». */
  description: ReactNode;
  fromDate: string;
  toDate: string;
  onChange: (range: ISODateRange) => void;
  /** Sana maydonidagi × (tanlovni tozalash). */
  onClear: () => void;
  /** «Yil» ro'yxati (SA/admin/registrator/market). */
  showYear?: boolean;
  /** Sana maydoni namunasi: «Boshlanish → Tugash» (sukut), kuryer — «Sana oralig'i». */
  rangePlaceholder?: string;
  /** Asosiy amal (market: «Buyurtma yaratish») — telefonda boshqaruvlar ustida, to'liq en. */
  primaryAction?: ReactNode;
  /** Sana maydonidagi × (sukut `true`); menejerda sukut davr (bugun) tanlanganda yo'q. */
  clearable?: boolean;
  /**
   * «Barchasi» tanlangan va backend oraliqni qisqartirgan (`clamped`) bo'lsa — sana maydonida haqiqiy oraliq
   * (`effective_from – effective_to`, tya24blo). Aks holda «Barchasi»da maydon bo'sh (namuna matni).
   */
  effectiveRange?: ISODateRange | null;
}

/**
 * DASHBOARD SARLAVHASI (barcha rollar, maket `.el-pagehead` + `.el-actions`): h1 «Bosh sahifa», izoh,
 * o'ngda davr — `SegmentedControl` «Bugun · Bu hafta · Bu oy · Barchasi» + «Yil» + `DateRange`.
 * Telefonda segment to'liq en, ostida «Yil» + sana bir qatorda. Davr darhol qo'llanadi (redux — sahifada).
 */
const DashboardHeader = ({
  description,
  fromDate,
  toDate,
  onChange,
  onClear,
  showYear = true,
  rangePlaceholder,
  primaryAction,
  clearable = true,
  effectiveRange = null,
}: DashboardHeaderProps) => {
  const { t } = useTranslation("dashboard");
  const period = resolveDashboardPeriod(fromDate, toDate);
  const hasRange = Boolean(fromDate && toDate);
  // Bo'sh oraliq — bugun (backend sukuti), segmentda ham «Bugun» tanlangan ko'rinadi.
  const activeQuick: QuickKey | typeof CUSTOM =
    period.kind === "today" || period.kind === "week" || period.kind === "month" || period.kind === "all"
      ? period.kind
      : CUSTOM;

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [
      { value: "", label: t("v2Dashboard.header.year") },
      ...Array.from({ length: YEAR_COUNT }, (_, index) => {
        const year = String(current - index);
        return { value: year, label: year };
      }),
    ];
  }, [t]);

  const rangeValue =
    period.kind === "all" ? effectiveRange : hasRange ? { from: fromDate, to: toDate } : null;

  const controls = (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-md:w-full">
      <SegmentedControl<QuickKey | typeof CUSTOM>
        ariaLabel={t("v2Dashboard.header.periodLabel")}
        value={activeQuick}
        onValueChange={(key) => {
          if (key !== CUSTOM) onChange(getPresetDateRange(key));
        }}
        options={QUICK_KEYS.map((key) => ({ value: key, label: t(`quickRanges.${key}`) }))}
      />
      <div className="flex min-w-0 items-center gap-2 max-md:w-full">
        {showYear ? (
          <div className="w-[112px] shrink-0 max-md:w-[108px]">
            <Select
              aria-label={t("v2Dashboard.header.yearLabel")}
              options={yearOptions}
              value={period.kind === "year" ? String(period.year) : ""}
              onChange={(value) => {
                const year = Number(value);
                if (year) onChange(getYearRange(year));
                else onClear();
              }}
            />
          </div>
        ) : null}
        <DateRange
          value={rangeValue}
          onChange={(range) => {
            if (!range.from && !range.to) onClear();
            else onChange(range);
          }}
          presets={false}
          placeholder={rangePlaceholder ?? t("v2Dashboard.header.rangePlaceholder")}
          clearable={clearable}
          className={cx("min-w-0 md:w-[260px]", "max-md:flex-1")}
        />
      </div>
      {/* Asosiy amal: desktopda boshqaruvlardan keyin (maket), telefonda eng tepada, to'liq en. */}
      {primaryAction ? <div className="max-md:order-first max-md:w-full max-md:[&>*]:w-full">{primaryAction}</div> : null}
    </div>
  );

  return <PageHeader title={t("v2Dashboard.header.title")} description={description} actions={controls} />;
};

export default memo(DashboardHeader);
