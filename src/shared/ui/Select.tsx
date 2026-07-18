import { memo, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { SelectProps } from "./Select.types";
import { setFilterValue } from "../../features/Select/model/FilterSlice";
import { useQueryParams } from "../lib/useQueryParams";
import type { RootState } from "../../app/config/store";

const Select = memo(
    ({
        label,
        name,
        value,
        onChange,
        options,
        placeholder = "Tanlang...",
        error,
        disabled = false,
        loading = false,
        required = false,
        icon: Icon,
        className = "",
        useRedux = false,
        reduxKey,
    }: SelectProps) => {
        const { t } = useTranslation("common");
        const dispatch = useDispatch();
        const { setParam } = useQueryParams();

        // Redux dan qiymatni olish (agar useRedux true bo'lsa)
        const reduxValue = useSelector((state: RootState) => {
            if (useRedux && reduxKey) {
                return (state.filter[reduxKey] as string) || '';
            }
            return '';
        });

        // Qaysi qiymatni ishlatish kerakligini aniqlash
        const currentValue = useRedux ? reduxValue : (value || '');

        const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
            const newValue = e.target.value;

            // Agar useRedux true bo'lsa, Redux ga saqlash
            if (useRedux && reduxKey) {
                dispatch(setFilterValue({ key: reduxKey, value: newValue }));

                // URL params ga ham saqlash
                setParam(reduxKey, newValue);
            }

            // Agar onChange callback berilgan bo'lsa, uni ham chaqirish
            if (onChange) {
                onChange(e);
            }
        };

        const inputClasses = `
      w-full bg-[color:var(--color-card-surface-strong)] dark:bg-[color:var(--color-primarydark)] border 
      ${error
                ? "border-red-400 dark:border-red-500 focus:ring-red-400/20"
                : "border-[color:var(--color-border-soft)] dark:border-white/10 focus:border-main dark:focus:border-main focus:ring-main/10"
            } 
      rounded-xl ${Icon ? "pl-10" : "px-4"} pr-10 py-3 
      text-slate-800 dark:text-white text-sm font-medium
      placeholder:text-slate-400 dark:placeholder:text-white/30 
      focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm
      appearance-none cursor-pointer
      ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""}
      ${className}
    `;

        const labelClasses =
            "block text-xs font-bold text-slate-500 dark:text-white/60 mb-1.5 ml-1 uppercase tracking-wide";

        return (
            <div className="space-y-0 relative">
                {label && (
                    <label htmlFor={name} className={labelClasses}>
                        {label} {required && <span className="text-red-500">*</span>}
                    </label>
                )}

                <div className="relative group">
                    {/* Icon */}
                    {Icon && (
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 group-focus-within:text-main dark:group-focus-within:text-main transition-colors pointer-events-none z-10">
                            <Icon size={18} />
                        </div>
                    )}

                    {/* Select Input */}
                    <select
                        id={name}
                        name={name}
                        value={currentValue}
                        onChange={handleChange}
                        disabled={disabled || loading}
                        required={required}
                        className={inputClasses}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${name}-error` : undefined}
                    >
                        <option value="" className="dark:text-white/50">
                            {loading ? t("loading") : placeholder}
                        </option>
                        {options.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                disabled={opt.disabled}
                                className="bg-[color:var(--color-card-surface-strong)] text-slate-800 dark:bg-[color:var(--color-primarydark)] dark:text-white"
                            >
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* Dropdown Arrow Icon */}
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-white/40 group-focus-within:text-main dark:group-focus-within:text-main transition-colors">
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-slate-300 dark:border-white/30 border-t-main dark:border-t-main rounded-full animate-spin" />
                        ) : (
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
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

                {/* Error Message */}
                {error && (
                    <p
                        id={`${name}-error`}
                        className="absolute -bottom-4 right-0 text-[10px] text-red-500 font-medium"
                        role="alert"
                    >
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Select.displayName = "Select";

export default Select;
