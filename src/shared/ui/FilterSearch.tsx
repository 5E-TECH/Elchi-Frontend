import { memo, useState, useEffect, type ChangeEvent } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "../lib/useDebounce";

interface FilterSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceDelay?: number;
    className?: string;
}

const FilterSearch = memo(({
    value,
    onChange,
    placeholder = "Qidirish...",
    debounceDelay = 600,
    className = "",
}: FilterSearchProps) => {
    const [localValue, setLocalValue] = useState(value);

    // Tashqi value o'zgarganda (tozalash holati) sync qilish
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const debouncedOnChange = useDebounce((val: string) => {
        onChange(val);
    }, debounceDelay);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        debouncedOnChange(val);
    };

    const handleClear = () => {
        setLocalValue("");
        onChange("");
    };

    return (
        <div className={`relative group ${className}`}>
            {/* Search icon */}
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Search
                    size={16}
                    className="text-gray-400 group-focus-within:text-main dark:text-white/40 dark:group-focus-within:text-main transition-colors"
                />
            </div>

            <input
                type="text"
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                className="
                    w-full
                    bg-white dark:bg-primarydark
                    border border-gray-200 dark:border-white/10
                    rounded-xl pl-10 pr-9 py-2.5
                    text-sm font-medium
                    text-maindark dark:text-primary
                    placeholder:text-gray-400 dark:placeholder:text-white/30
                    focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
                    transition-all duration-200
                "
            />

            {/* Clear button */}
            {localValue && (
                <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 transition-colors"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
});

FilterSearch.displayName = "FilterSearch";

export default FilterSearch;
