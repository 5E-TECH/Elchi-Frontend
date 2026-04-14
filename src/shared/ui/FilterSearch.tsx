import { memo, useState, useEffect } from "react";
import { useDebounce } from "../lib/useDebounce";
import { GlobalSearchInput } from "../../features/search";

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

    const handleChange = (val: string) => {
        setLocalValue(val);
        debouncedOnChange(val);
    };

    return (
        <GlobalSearchInput
            value={localValue}
            onValueChange={handleChange}
            placeholder={placeholder}
            className={className}
            inputClassName="
                h-12
                bg-white dark:bg-primarydark
                border-2 border-gray-200 dark:border-primarydark/30
                rounded-xl py-0
                text-sm font-medium
                text-maindark dark:text-white
                placeholder:text-gray-400 dark:placeholder:text-white/30
            "
            iconClassName="text-gray-400 group-focus-within:text-main dark:text-white/40 dark:group-focus-within:text-main"
            clearButtonClassName="text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70"
        />
    );
});

FilterSearch.displayName = "FilterSearch";

export default FilterSearch;
