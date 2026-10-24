// dizayn-v2: superadmin-products-create, superadmin-products-edit-dialog, superadmin-regions-delivery-tariffs
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Pressable } from "../../../shared/ui/primitives";

export type VolumetricSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Ostidagi izoh (yoqiq / o'chiq holatga qarab): mahsulot formasida bor, kalkulyatorda yo'q. */
  withDescription?: boolean;
  disabled?: boolean;
  id?: string;
};

/**
 * «HAJMGA QARAB HISOBLASH» KALITI — maket `.el-switch` (CODE-MAP 2.2): matn chapda, kalit o'ngda (36 × 20, yoqiq
 * `action`, o'chiq `border-strong`), bosish maydoni 44 px. Yorliq (`<label for>`) bosilsa ham almashadi. O'chiq —
 * «Yetkazish narxi faqat real og'irlikdan hisoblanadi. O'lchamlar baribir kiritiladi va saqlanadi.»
 */
export const VolumetricSwitch = ({ checked, onChange, withDescription = false, disabled, id }: VolumetricSwitchProps) => {
  const { t } = useTranslation("deliveryPricing");
  const autoId = useId();
  const switchId = id ?? `volumetric-${autoId}`;
  const descriptionId = `${switchId}-description`;
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={switchId} className="cursor-pointer text-sm font-semibold text-text">
          {t("volumetric.label")}
        </label>
        {withDescription ? (
          <span id={descriptionId} aria-live="polite" className="text-[13px] leading-[18px] text-text-muted">
            {checked ? t("volumetric.on") : t("volumetric.off")}
          </span>
        ) : null}
      </div>
      <Pressable
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-describedby={withDescription ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group relative -mr-1.5 inline-flex h-11 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={cx(
            "relative h-5 w-9 rounded-full transition-colors duration-150 motion-reduce:transition-none group-disabled:opacity-45",
            checked ? "bg-action" : "bg-border-strong",
          )}
        >
          <span
            className={cx(
              "absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 motion-reduce:transition-none",
              checked && "translate-x-4",
            )}
          />
        </span>
      </Pressable>
    </div>
  );
};
