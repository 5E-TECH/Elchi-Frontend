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
  /** Qatordagi natija (belgilanmagani — sukut «sotildi», BeePost modeli); `null` — hech qaysi tanlanmagan. */
  value: CourierBulkAction | null;
  /** Mijoz nomi — guruh nomi «{name}: natija». */
  name: string;
  onChange: (value: CourierBulkAction) => void;
  /**
   * Natija sukut bo'yicha («Sotildi» belgilanmagan qatorda). Shunda «Sotildi» allaqachon tanlangan ko'rinadi va
   * `SegmentedControl` uni qayta bosishni e'tiborsiz qoldiradi — bosish baribir ANIQ «sotildi» belgisini qo'yadi
   * («Belgilanmagan» yo'qoladi, tasdiq katagi sanog'idan chiqadi).
   */
  implicit?: boolean;
  disabled?: boolean;
  /** `table` — jadval qatorida ixcham; `list` — planshet/telefon kartasida to'liq enli, har variant ≥ 44 px. */
  layout: "table" | "list";
};

/**
 * Qator natijasi: «Sotildi | Bekor | Ertaga» (maket `courier-courier-bulk-main`). Belgilanmagan qatorda «Sotildi»
 * tanlangan ko'rinadi — yakunlashda u sotiladi (ega 2026-11-21, BeePost modeli); variant tanlansa belgi qo'yiladi va
 * guruh o'sha ton fonida bo'ladi. `SegmentedControl` qiymati hech bir variantga mos kelmasa hech biri `aria-checked`
 * emas, Tab guruhning birinchi faol variantiga kiradi.
 */
export const ResultControl = ({
  value,
  name,
  onChange,
  implicit = false,
  disabled = false,
  layout,
}: ResultControlProps) => {
  const { t } = useTranslation("courierBulk");

  const control = (
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

  const promoteImplicit = implicit && value === "sold" && !disabled;
  return (
    // Sukut «Sotildi» qayta bosilsa (sichqoncha, Space / Enter) — aniq belgi qo'yiladi. O'ram DOIM bor: daraxt
    // o'zgarmasin (aks holda guruh qayta yaratilib, klaviatura fokusi yo'qolardi).
    <div
      className="contents"
      onClickCapture={
        promoteImplicit
          ? (event) => {
              const radio = (event.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
              if (radio?.dataset.value === "sold") onChange("sold");
            }
          : undefined
      }
    >
      {control}
    </div>
  );
};
