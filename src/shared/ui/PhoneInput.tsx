import { memo, type FocusEventHandler } from "react";
import { Phone } from "lucide-react";
import {
  formatUzbekistanPhoneLocal,
  toUzbekistanPhoneValue,
  UZBEKISTAN_PHONE_PREFIX,
} from "../lib/phone";

interface PhoneInputProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
}

const PhoneInput = ({
  name,
  value = UZBEKISTAN_PHONE_PREFIX,
  onChange,
  onBlur,
  placeholder = "90 123 45 67",
  error = false,
  disabled = false,
}: PhoneInputProps) => {
  const displayValue = formatUzbekistanPhoneLocal(value);

  return (
    <div className="relative group">
      <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[color:var(--color-text-muted)] transition-colors group-focus-within:text-main dark:text-white/55 dark:group-focus-within:text-main">
        <Phone size={18} />
      </div>
      <div className="pointer-events-none absolute left-10 top-1/2 z-10 -translate-y-1/2 text-sm font-semibold text-maindark dark:text-white">
        {UZBEKISTAN_PHONE_PREFIX}
      </div>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        name={name}
        value={displayValue}
        onChange={(event) => onChange(toUzbekistanPhoneValue(event.target.value))}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-xl border-2 bg-[color:var(--color-card-surface-strong)] py-3 pl-[5.25rem] pr-4 text-sm font-semibold text-maindark shadow-sm outline-none transition-all placeholder:text-[color:var(--color-text-muted)] hover:shadow-sm focus:shadow-md dark:bg-[color:var(--color-primarydark)] dark:text-white dark:placeholder:text-white/55 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 dark:border-red-500"
            : "border-[color:var(--color-border-strong)] hover:border-main/60 focus:border-main focus:ring-2 focus:ring-main/15 dark:border-white/15 dark:hover:border-main/60 dark:focus:border-main"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />
    </div>
  );
};

export default memo(PhoneInput);
