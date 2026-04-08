import { Select } from "antd";
import { memo } from "react";

export type StatusFilterValue = "active" | "inactive" | "";

interface StatusSelectProps {
  value?: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  placeholder?: string;
}

const options = [
  { value: "", label: "Barchasi" },
  { value: "active", label: "Faol" },
  { value: "inactive", label: "Nofaol" },
];

const StatusSelect = ({ value = "", onChange, placeholder = "Holat" }: StatusSelectProps) => {
  return (
    <Select
      value={value}
      options={options}
      placeholder={placeholder}
      style={{ minWidth: 160 }}
      onChange={(nextValue) => onChange(nextValue as StatusFilterValue)}
    />
  );
};

export default memo(StatusSelect);
