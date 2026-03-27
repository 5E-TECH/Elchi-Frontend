import { memo, type ChangeEvent } from "react";
import type { LucideIcon } from "lucide-react";

export interface FilterSelectOption {
    value: string;
    label: string;
}

interface FilterSelectProps {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterSelectOption[];
    placeholder?: string;
    icon?: LucideIcon;
    loading?: boolean;
    disabled?: boolean;
    size?: "sm" | "md";
}

const FilterSelect = memo(({
    label,
    name,
    value,
    onChange,
    options,
    placeholder = "Tanlang...",
    icon: Icon,
    loading = false,
    disabled = false,
    size = "md",
}: FilterSelectProps) => {
    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
    };

    const selectSizeClass =
        size === "sm"
            ? "rounded-lg px-3 py-2 pr-8 text-[13px]"
            : "rounded-xl px-3.5 py-2.5 pr-9 text-sm";

    return (
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor={name}
                className="text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider flex items-center gap-1.5"
            >
                {Icon && <Icon size={11} className="text-main/70" />}
                {label}
            </label>

            <div className="relative group">
                <select
                    id={name}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    disabled={disabled || loading}
                    className={`
                        w-full appearance-none cursor-pointer
                        bg-white dark:bg-primarydark
                        border border-gray-200 dark:border-white/10
                        ${selectSizeClass}
                        font-medium
                        text-maindark dark:text-primary
                        placeholder:text-gray-400 dark:placeholder:text-white/30
                        focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    <option value="">
                        {loading ? "Yuklanmoqda..." : placeholder}
                    </option>
                    {options.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                            className="dark:bg-primarydark text-maindark dark:text-primary"
                        >
                            {opt.label}
                        </option>
                    ))}
                </select>

                {/* Dropdown arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-white/40 group-focus-within:text-main transition-colors">
                    {loading ? (
                        <div className="w-3.5 h-3.5 border-2 border-gray-300 dark:border-white/30 border-t-main rounded-full animate-spin" />
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                                d="M2.5 4.5L6 8L9.5 4.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
});

FilterSelect.displayName = "FilterSelect";

export default FilterSelect;
