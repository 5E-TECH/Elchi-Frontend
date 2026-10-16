import { memo } from "react";
import { DateInput } from "./primitives/DateInput";

/**
 * v1 API (bitta sana, `"YYYY-MM-DD"`) — ichi dizayn v2 `DateInput` (3-bosqich).
 * Yangi kodda `DateInput` (`shared/ui/primitives`) ni `Field` bilan ishlating.
 */
interface CustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minDate?: string;
    maxDate?: string;
    className?: string;
    /** Maydon nomi (`Field` siz; sukut «Sana»). */
    "aria-label"?: string;
    /** @deprecated v1 o'lchami — v2 maydon bitta o'lchamda (40 px, telefonda 44 px), e'tiborga olinmaydi. */
    size?: "sm" | "md";
    /** @deprecated v1 ko'rinishlari (`default | filter | form`) — v2 da bitta maydon, e'tiborga olinmaydi. */
    variant?: "default" | "filter" | "form";
    /** @deprecated v2 popover joy bo'lmasagina tepaga ag'dariladi — e'tiborga olinmaydi. */
    placement?: "auto" | "bottom";
}

const CustomDatePicker = memo(({
    value,
    onChange,
    placeholder,
    minDate,
    maxDate,
    className = "",
    "aria-label": ariaLabel,
}: CustomDatePickerProps) => (
    <DateInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={minDate}
        max={maxDate}
        aria-label={ariaLabel}
        className={className}
    />
));

CustomDatePicker.displayName = "CustomDatePicker";

export default CustomDatePicker;
