import { memo } from "react";
import { Minus, Check } from "lucide-react";

interface CheckboxProps {
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
}

const Checkbox = memo(
    ({ checked, indeterminate = false, onChange }: CheckboxProps) => (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onChange();
            }}
            className={`relative flex items-center justify-center w-5.5 h-5.5 rounded-lg border-2 transition-all duration-300 transform active:scale-95 shrink-0 cursor-pointer ${checked || indeterminate
                    ? "bg-main border-main shadow-[0_0_12px_rgba(87,106,219,0.45)]"
                    : "border-gray-200 dark:border-white/20 bg-white/5 dark:bg-white/5 hover:border-main/50 hover:bg-main/5"
                }`}
        >
            {indeterminate && !checked ? (
                <Minus size={12} className="text-white animate-in zoom-in-50 duration-200" strokeWidth={4} />
            ) : checked ? (
                <Check
                    size={14}
                    className="text-white animate-in zoom-in-50 fade-in duration-200"
                    strokeWidth={4}
                />
            ) : null}
        </button>
    ),
);
Checkbox.displayName = "Checkbox";

export default Checkbox;

