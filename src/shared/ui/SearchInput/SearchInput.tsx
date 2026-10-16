import { memo, useEffect, useState } from "react";
import { useDebounce } from "../../lib/useDebounce";
import { TextInput } from "../primitives/TextInput";

/**
 * QIDIRUV MAYDONI — eski API (`onSearch` kechikish bilan), ichi dizayn v2 `TextInput mode="search"`
 * (`.el-search`): chapda `Search`, o'ngda × (tozalash), Enter — darhol, Esc — tozalash.
 * Ko'rinadigan yorliq yo'q — `placeholder` maydon nomi (`aria-label`) bo'ladi.
 */
interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onSearch: (value: string) => void;
  delay?: number;
}

const SearchInput = ({ placeholder = "Qidirish", value = "", onSearch, delay = 400 }: SearchInputProps) => {
  const [innerValue, setInnerValue] = useState(value);
  const debouncedSearch = useDebounce((nextValue: string) => onSearch(nextValue), delay);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  return (
    <TextInput
      mode="search"
      value={innerValue}
      placeholder={placeholder}
      aria-label={placeholder}
      onValueChange={(nextValue) => {
        setInnerValue(nextValue);
        debouncedSearch(nextValue);
      }}
      onClear={() => onSearch("")}
      onSearch={(current) => onSearch(current)}
    />
  );
};

export default memo(SearchInput);
