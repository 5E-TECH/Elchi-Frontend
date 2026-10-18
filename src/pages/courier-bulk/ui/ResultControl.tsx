// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main
import type { MouseEvent } from "react";
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

type ResultControlProps = {
  /** Qatordagi natija (belgilanmagani — `sold`). */
  value: CourierBulkAction;
  /** Qo'lda belgilanganmi: belgilanmagan «Sotildi» oddiy (`surface`), belgilangani — ton fonida. */
  marked: boolean;
  /** Mijoz nomi — guruh nomi «{name}: natija». */
  name: string;
  onChange: (value: CourierBulkAction) => void;
  disabled?: boolean;
  /** `table` — jadval qatorida ixcham; `list` — planshet/telefon kartasida to'liq enli, har variant ≥ 44 px. */
  layout: "table" | "list";
};

/**
 * Qator natijasi: «Sotildi | Bekor | Ertaga» (maket `courier-courier-bulk-main`). Variant tanlansa — belgi qo'yiladi
 * (`sold` ham aniq belgi). Belgilanmagan qatorda «Sotildi» allaqachon tanlangan ko'rinadi — uni bosish ham aniq
 * belgi qo'yadi: primitiv tanlangan variantni qayta tanlamaydi, shuning uchun guruh `click` ni o'zi tutadi
 * (klaviaturada Bo'sh joy / Enter ham `click`).
 */
export const ResultControl = ({ value, marked, name, onChange, disabled = false, layout }: ResultControlProps) => {
  const { t } = useTranslation("courierBulk");

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || marked) return;
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
    if (option?.dataset.value === "sold" && value === "sold") onChange("sold");
  };

  return (
    <SegmentedControl<CourierBulkAction>
      ariaLabel={t("list.resultLabel", { name })}
      value={value}
      onValueChange={onChange}
      onClick={handleClick}
      fullWidth={layout === "list"}
      options={[
        { value: "sold", label: t("list.sold"), icon: PackageCheck, disabled },
        { value: "cancel", label: t("list.cancel"), icon: CircleX, disabled },
        { value: "tomorrow", label: t("list.tomorrow"), icon: CalendarClock, disabled },
      ]}
      className={cx(
        layout === "list" ? "[&>[role=radio]]:min-h-11" : "shrink-0",
        SEGMENT_TINT[marked ? TINT[value] : "none"],
      )}
    />
  );
};
