import { memo } from "react";

/**
 * Toggle — dizayn-tizimga mos switch (yoqilgan/o'chirilgan).
 * Sozlamalar va boshqa joylarda qayta ishlatiladi.
 */
export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

const Toggle = memo(({ checked, onChange, disabled, ...rest }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={rest["aria-label"]}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50"
    style={{
      background: checked
        ? "var(--color-main)"
        : "color-mix(in srgb, var(--color-dashboard-text-muted) 28%, transparent)",
    }}
  >
    <span
      className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200"
      style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
    />
  </button>
));

Toggle.displayName = "Toggle";

export default Toggle;
