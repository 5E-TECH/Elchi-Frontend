// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main
import { CalendarClock, CircleX } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { SegmentedControl } from "../../../shared/ui/primitives";
import type { CourierBulkScanMode } from "../model/courierBulk";
import { SEGMENT_TINT } from "./segmentTint";

/**
 * «Skanerlash rejimi»: «Bekor qilish | Ertaga qoldirish» (telefonda «Bekor | Ertaga», to'liq enli, 44 px).
 * Tanlangan rejim ton fonida (bekor — `danger-soft`, ertaga — `warning-soft`).
 */
export const ScanModeControl = ({
  value,
  onChange,
  compact,
  labelledBy,
}: {
  value: CourierBulkScanMode;
  onChange: (value: CourierBulkScanMode) => void;
  /** Telefon: qisqa yorliqlar, to'liq enli. */
  compact: boolean;
  /** Ko'rinadigan sarlavha `id` si (guruh nomi). */
  labelledBy?: string;
}) => {
  const { t } = useTranslation("courierBulk");
  return (
    <SegmentedControl<CourierBulkScanMode>
      ariaLabel={t("scanMode.title")}
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={onChange}
      fullWidth={compact}
      options={[
        { value: "cancel", label: t(compact ? "scanMode.cancelShort" : "scanMode.cancel"), icon: CircleX },
        { value: "tomorrow", label: t(compact ? "scanMode.tomorrowShort" : "scanMode.tomorrow"), icon: CalendarClock },
      ]}
      className={cx(compact ? "[&>[role=radio]]:min-h-11" : "shrink-0", SEGMENT_TINT[value === "cancel" ? "danger" : "warning"])}
    />
  );
};

/** «Skanerlangan buyurtma **bekor qilishga** belgilanadi». */
export const ScanModeHint = ({ value, className }: { value: CourierBulkScanMode; className?: string }) => {
  const { t } = useTranslation("courierBulk");
  return (
    <p className={cx("text-[13px] text-text-muted", className)}>
      <Trans
        t={t}
        ns="courierBulk"
        i18nKey={value === "cancel" ? "scanMode.hintCancel" : "scanMode.hintTomorrow"}
        components={{ strong: <strong className="font-semibold text-text" /> }}
      />
    </p>
  );
};
