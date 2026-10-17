// dizayn-v2: superadmin-regions-map, admin-regions-map, manager-regions-scoped, courier-regions-scoped
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { DateRange, SegmentedControl } from "../../../shared/ui/primitives";
import {
  QUICK_PERIODS,
  type RegionCustomRange,
  type RegionPeriod,
  type RegionQuickPeriod,
} from "../model/regionPeriod";

export interface RegionPeriodControlsProps {
  period: RegionPeriod;
  customRange: RegionCustomRange | null;
  onQuick: (period: RegionQuickPeriod) => void;
  onRange: (range: RegionCustomRange) => void;
  /** Sana maydonidagi × — «Barchasi» (oldingi xulq). */
  onClear: () => void;
  className?: string;
}

const CUSTOM = "custom";

/**
 * DAVR: `SegmentedControl` «Bugun · Bu hafta · Bu oy · Barchasi» + `DateRange` «Boshlanish → Tugash»
 * (tez tanlov chiplarsiz — yonida segment bor). Telefonda ikkalasi to'liq en, ustma-ust (maket).
 */
const RegionPeriodControls = ({
  period,
  customRange,
  onQuick,
  onRange,
  onClear,
  className,
}: RegionPeriodControlsProps) => {
  const { t } = useTranslation("region");
  return (
    <div
      className={cx(
        "flex min-w-0 flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch max-md:gap-2",
        className,
      )}
    >
      <SegmentedControl<RegionQuickPeriod | typeof CUSTOM>
        ariaLabel={t("v2.period.label")}
        value={period}
        onValueChange={(next) => {
          if (next !== CUSTOM) onQuick(next);
        }}
        options={QUICK_PERIODS.map((key) => ({ value: key, label: t(`v2.period.${key}`) }))}
      />
      <DateRange
        value={
          period === "custom" && customRange
            ? { from: customRange.start, to: customRange.end }
            : null
        }
        onChange={(range) => {
          if (range.from && range.to) onRange({ start: range.from, end: range.to });
          else onClear();
        }}
        presets={false}
        placeholder={t("v2.period.rangePlaceholder")}
        aria-label={t("v2.period.rangeAria")}
        className="min-w-0 md:w-[260px]"
      />
    </div>
  );
};

export default RegionPeriodControls;
