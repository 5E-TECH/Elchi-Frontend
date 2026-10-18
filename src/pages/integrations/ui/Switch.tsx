// dizayn-v2: superadmin-integrations-panel-settings, superadmin-integrations-legacy-source-create
import type { ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";
import { useFieldControl } from "../../../shared/ui/primitives";

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Kalit yonidagi matn (masalan «Sinov rejimi o'chirilgan»). Berilmasa — `aria-label` majburiy. */
  label?: ReactNode;
  /** Ostidagi izoh (13 px, `text-muted`). */
  description?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
  className?: string;
};

/**
 * KALIT — maketdagi `.el-switch` (CODE-MAP 2.2): 36×20, o'chiq `border-strong`, yoqiq `action`,
 * `role="switch"` + `aria-checked`. Bosish maydoni — butun qator (telefonda ≥ 44 px). `Field` ichida
 * bo'lsa yorliq va izoh avtomatik bog'lanadi (`useFieldControl`).
 */
export const Switch = ({ checked, onChange, label, description, disabled, className, id, ...rest }: SwitchProps) => {
  const control = useFieldControl({ id, disabled });
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      id={control.id}
      aria-describedby={control["aria-describedby"]}
      disabled={control.disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "group inline-flex min-h-10 max-w-full items-start gap-3 rounded-[10px] text-left",
        "disabled:cursor-not-allowed max-md:min-h-11",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative mt-0.5 h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none",
          "group-aria-checked:bg-action group-disabled:opacity-45",
        )}
      >
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-surface shadow-xs transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
      </span>
      {label != null || description != null ? (
        <span className="flex min-w-0 flex-col gap-0.5">
          {label != null ? <span className="text-sm font-semibold text-text">{label}</span> : null}
          {description != null ? <span className="text-[13px] leading-[18px] text-text-muted">{description}</span> : null}
        </span>
      ) : null}
    </button>
  );
};

export default Switch;
