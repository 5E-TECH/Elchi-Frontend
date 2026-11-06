// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main
import { CalendarClock, CircleX, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { SegmentedControl } from "../../../shared/ui/primitives";
import type { CourierBulkAction } from "../model/courierBulk";
import { SEGMENT_TINT } from "./segmentTint";

const TINT: Record<CourierBulkAction, keyof typeof SEGMENT_TINT> = {
  sold: "success",
  cancel: "danger",
  tomorrow: "warning",
};

/** Belgilanmagan qator — hech qaysi variant tanlanmagan (guruhda bunday variant yo'q). */
const NONE = "" as const;

type ResultControlProps = {
  /** Qatordagi natija; `null` — belgilanmagan (sukut natija yo'q, yakunlashda o'zgarmaydi). */
  value: CourierBulkAction | null;
  /** Mijoz nomi — guruh nomi «{name}: natija». */
  name: string;
  onChange: (value: CourierBulkAction) => void;
  disabled?: boolean;
  /** `table` — jadval qatorida ixcham; `list` — planshet/telefon kartasida to'liq enli, har variant ≥ 44 px. */
  layout: "table" | "list";
};

/**
 * Qator natijasi: «Sotildi | Bekor | Ertaga» (maket `courier-courier-bulk-main`). Belgilanmagan qatorda hech qaysi
 * variant tanlanmagan (ega 2026-11-05: «default hech nimada turmasligi kerak») — variant tanlansa belgi qo'yiladi va
 * guruh o'sha ton fonida bo'ladi. `SegmentedControl` qiymati hech bir variantga mos kelmasa hech biri `aria-checked`
 * emas, Tab guruhning birinchi faol variantiga kiradi.
 */
export const ResultControl = ({ value, name, onChange, disabled = false, layout }: ResultControlProps) => {
  const { t } = useTranslation("courierBulk");

  return (
    <SegmentedControl<CourierBulkAction | typeof NONE>
      ariaLabel={t("list.resultLabel", { name })}
      value={value ?? NONE}
      onValueChange={(next) => {
        if (next !== NONE) onChange(next);
      }}
      fullWidth={layout === "list"}
      options={[
        { value: "sold", label: t("list.sold"), icon: PackageCheck, disabled },
        { value: "cancel", label: t("list.cancel"), icon: CircleX, disabled },
        { value: "tomorrow", label: t("list.tomorrow"), icon: CalendarClock, disabled },
      ]}
      className={cx(
        layout === "list" ? "[&>[role=radio]]:min-h-11" : "shrink-0",
        SEGMENT_TINT[value ? TINT[value] : "none"],
      )}
    />
  );
};
