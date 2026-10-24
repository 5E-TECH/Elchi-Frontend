// dizayn-v2: superadmin-users-edit-market-warehouse
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { Pressable } from "../../../../shared/ui/primitives";

export type WarehouseOrderSectionProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

/**
 * «OMBOR» BO'LIMI — market tahririda «Ombordan buyurtma yaratish» kaliti (maket `superadmin-users-edit-market-warehouse`,
 * ega qarori 5: sukut o'chiq, faqat superadmin/admin). `sunken` blok: sarlavha + izoh, o'ngda `.el-switch`
 * (`role="switch"`, bosish maydoni 44 px); ostida «Sukut — o'chiq…» izohi. Yorliq bosilsa ham almashadi.
 */
export const WarehouseOrderSection = ({ checked, onChange, disabled }: WarehouseOrderSectionProps) => {
  const { t } = useTranslation("warehouses");
  const id = useId();
  const switchId = `${id}-switch`;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("marketOrder.section")}</h3>
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-center justify-between gap-4 rounded-xl bg-sunken py-2 pl-4 pr-2.5">
          <label htmlFor={switchId} className="flex min-w-0 cursor-pointer flex-col gap-0.5 py-1.5">
            <span id={labelId} className="text-sm font-semibold text-text">
              {t("marketOrder.label")}
            </span>
            <span id={hintId} className="text-[13px] leading-[18px] text-text-muted">
              {t("marketOrder.description")}
            </span>
          </label>
          <Pressable
            id={switchId}
            role="switch"
            aria-checked={checked}
            aria-labelledby={labelId}
            aria-describedby={hintId}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className="group relative inline-flex h-11 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed"
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
        <p className="m-0 text-xs text-text-muted">{t("marketOrder.hint")}</p>
      </div>
    </section>
  );
};
