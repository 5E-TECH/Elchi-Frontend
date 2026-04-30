import {
    memo,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { setFilterValue } from "../../features/Select/model/FilterSlice";
import { useQueryParams } from "../lib/useQueryParams";
import type { RootState } from "../../app/config/store";

export interface FilterSelectOption {
    value: string;
    label: string;
    icon?: LucideIcon;
}

interface FilterSelectProps {
    label: string;
    name: string;
    value?: string;
    onChange?: (value: string) => void;
    options: FilterSelectOption[];
    placeholder?: string;
    icon?: LucideIcon;
    loading?: boolean;
    disabled?: boolean;
    size?: "sm" | "md";
    hideLabel?: boolean;
    useRedux?: boolean;
    reduxKey?: string;
    urlKey?: string;
}

const FilterSelect = memo(({
    label,
    name,
    value = "",
    onChange,
    options,
    placeholder = "Tanlang...",
    icon: Icon,
    loading = false,
    disabled = false,
    size = "md",
    hideLabel = false,
    useRedux = false,
    reduxKey,
    urlKey,
}: FilterSelectProps) => {
    const { t } = useTranslation("common");
    const dispatch = useDispatch();
    const { setParam, removeParam } = useQueryParams();
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const reduxValue = useSelector((state: RootState) =>
        useRedux && reduxKey ? (state.filter[reduxKey] as string) || "" : "",
    );
    const currentValue = useRedux ? reduxValue : value;
    const selectedOption = useMemo(
        () => options.find((option) => option.value === currentValue),
        [currentValue, options],
    );
    const dropdownOptions = useMemo(
        () => [{ value: "", label: placeholder }, ...options],
        [options, placeholder],
    );

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const selectedIndex = dropdownOptions.findIndex(
            (option) => option.value === currentValue,
        );
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }, [currentValue, dropdownOptions, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }, [highlightedIndex, isOpen]);

    const handleChange = (nextValue: string) => {

        if (useRedux && reduxKey) {
            dispatch(setFilterValue({ key: reduxKey, value: nextValue }));
            const paramKey = urlKey ?? reduxKey;

            if (nextValue) {
                setParam(paramKey, nextValue);
            } else {
                removeParam(paramKey);
            }
        }

        onChange?.(nextValue);
        setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();

            if (isOpen) {
                handleChange(dropdownOptions[highlightedIndex]?.value ?? "");
                return;
            }

            setIsOpen(true);
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((current) =>
                current < dropdownOptions.length - 1 ? current + 1 : 0,
            );
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((current) =>
                current > 0 ? current - 1 : dropdownOptions.length - 1,
            );
            return;
        }

        if (event.key === "Escape") {
            setIsOpen(false);
        }
    };

    const selectSizeClass =
        size === "sm"
            ? "h-11 rounded-xl px-3.5"
            : "h-12 rounded-xl px-4";

    return (
        <div ref={containerRef} className="relative flex flex-col gap-1.5">
            {!hideLabel && (
                <label
                    htmlFor={name}
                    className="text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider flex items-center gap-1.5"
                >
                    {Icon && <Icon size={11} className="text-main/70" />}
                    {label}
                </label>
            )}

            <div
                className={`group relative flex w-full items-center border-2 text-left shadow-sm transition-all duration-200 outline-none ${selectSizeClass} bg-white/85 dark:bg-white/7 ${
                    isOpen
                        ? "border-main ring-2 ring-main/10"
                        : "border-white/70 hover:border-main/50 dark:border-white/10 dark:hover:border-main/50"
                } ${disabled || loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
                {Icon && (
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-main dark:text-white/40">
                        <Icon size={18} />
                    </span>
                )}

                <button
                    id={name}
                    name={name}
                    type="button"
                    onClick={() => !disabled && !loading && setIsOpen((current) => !current)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || loading}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    className={`min-w-0 flex-1 truncate bg-transparent text-left text-sm font-medium outline-none ${
                        selectedOption
                            ? "text-maindark dark:text-white"
                            : "text-gray-500 dark:text-white/55"
                    } ${Icon ? "pl-7" : ""}`}
                >
                    {loading ? t("loading") : selectedOption?.label ?? placeholder}
                </button>

                {loading ? (
                    <div className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 border-t-main dark:border-white/30 dark:border-t-main animate-spin" />
                ) : (
                    <ChevronDown
                        size={18}
                        className={`pointer-events-none shrink-0 text-gray-400 transition-all duration-200 dark:text-white/40 ${
                            isOpen ? "rotate-180 text-main" : ""
                        }`}
                    />
                )}
            </div>

            {isOpen && (
                <div
                    className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-primary)] shadow-[0_20px_45px_color-mix(in_srgb,var(--color-background-deep)_18%,transparent)] dark:border-white/10 dark:bg-[color:var(--color-primarydark)]"
                    role="listbox"
                    aria-labelledby={name}
                >
                    <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar">
                        {dropdownOptions.map((option, optionIndex) => {
                            const isPlaceholder = option.value === "";
                            const isSelected = option.value === currentValue;
                            const isHighlighted = optionIndex === highlightedIndex;

                            return (
                                <button
                                    key={option.value || "__empty"}
                                    ref={(element) => {
                                        optionRefs.current[optionIndex] = element;
                                    }}
                                    type="button"
                                    onClick={() => handleChange(option.value)}
                                    onMouseEnter={() => setHighlightedIndex(optionIndex)}
                                    className={`flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                                        isHighlighted
                                            ? "bg-main text-white shadow-sm shadow-main/25"
                                            : isSelected && !isPlaceholder
                                                ? "bg-main/15 text-main dark:bg-main/25 dark:text-primary"
                                                : "text-maindark hover:bg-main/10 dark:text-primary dark:hover:bg-white/8"
                                    } ${isPlaceholder && !isHighlighted ? "text-gray-500 dark:text-white/50" : ""}`}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    {option.icon ? (
                                        <option.icon size={15} className="shrink-0" />
                                    ) : null}
                                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                    {isSelected && !isPlaceholder ? (
                                        <Check size={15} className="shrink-0" />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

FilterSelect.displayName = "FilterSelect";

export default FilterSelect;
