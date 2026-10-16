import { memo, useEffect, useState } from "react";
import { extractScannerToken } from "../lib/scanToken";
import { useDebounce } from "../lib/useDebounce";
import { TextInput } from "./primitives/TextInput";

/**
 * FILTR QIDIRUVI — eski API (`value` / `onChange` kechikish bilan), ichi dizayn v2
 * `TextInput mode="search"` (`.el-search`, taxta `tizim-states-forms` 02 «Qidiruv»): chapda `Search`,
 * yozilganda o'ngda × («Qidiruvni tozalash», fokus maydonda qoladi), Enter — darhol qidirish,
 * Esc — tozalash.
 *
 * Yozish `debounceDelay` ms kutib `onChange` ga boradi; tozalash va Enter — darhol.
 * Skaner yoki kamera QR havolasini (`…/scan/<token>`) yopishtirsa — token qoldiriladi (avvalgidek).
 * Ko'rinadigan yorliq yo'q — `placeholder` maydon nomi (`aria-label`) bo'ladi.
 */
interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceDelay?: number;
  className?: string;
}

/** QR havolasi (`https://…/scan/<token>`) → token; boshqa matn o'zgarmaydi. */
const normalizePossibleScanValue = (nextValue: string) => {
  if (!nextValue.includes("/scan/")) return nextValue;
  const token = extractScannerToken(nextValue, window.location.origin);
  return token && token.length >= 6 ? token : nextValue;
};

const FilterSearch = memo(
  ({ value, onChange, placeholder = "Qidirish...", debounceDelay = 600, className }: FilterSearchProps) => {
    const [localValue, setLocalValue] = useState(value);

    // Tashqi value o'zgarganda (tozalash holati) sync qilish
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const debouncedOnChange = useDebounce((next: string) => {
      onChange(next);
    }, debounceDelay);

    const handleChange = (raw: string) => {
      const next = normalizePossibleScanValue(raw);
      setLocalValue(next);
      debouncedOnChange(next);
    };

    return (
      <TextInput
        mode="search"
        value={localValue}
        onValueChange={handleChange}
        onClear={() => onChange("")}
        onSearch={(current) => onChange(current)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={className}
      />
    );
  },
);

FilterSearch.displayName = "FilterSearch";

export default FilterSearch;
