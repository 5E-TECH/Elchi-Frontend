import { memo } from "react";
import CustomDatePicker from "./CustomDatePicker";

interface FilterDateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  placement?: "auto" | "bottom";
}

const labelClassName =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-table-label)] dark:text-white/50";

const FilterDateInput = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placement = "auto",
}: FilterDateInputProps) => (
  <label className="block">
    <span className={labelClassName}>{label}</span>
    <CustomDatePicker
      value={value}
      onChange={onChange}
      placeholder={label}
      minDate={minDate}
      maxDate={maxDate}
      variant="filter"
      placement={placement}
      className="w-full"
    />
  </label>
);

export default memo(FilterDateInput);
