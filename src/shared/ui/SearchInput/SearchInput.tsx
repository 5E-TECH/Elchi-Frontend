import { Input } from "antd";
import { memo, useEffect, useState } from "react";
import { SearchOutlined } from "@ant-design/icons";
import { useDebounce } from "../../lib/useDebounce";

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
    <Input
      allowClear
      value={innerValue}
      prefix={<SearchOutlined />}
      placeholder={placeholder}
      onChange={(event) => {
        const nextValue = event.target.value;
        setInnerValue(nextValue);
        debouncedSearch(nextValue);
      }}
    />
  );
};

export default memo(SearchInput);
