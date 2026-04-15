import { memo } from "react";
import { Select } from "antd";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export interface FilterMultiSelectOption {
  value: string;
  label: string;
}

interface FilterMultiSelectProps {
  label: string;
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: FilterMultiSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
}

const FilterMultiSelect = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "Tanlang...",
  icon: Icon,
  loading = false,
  disabled = false,
}: FilterMultiSelectProps) => {
  return (
    <div className="relative space-y-0">
      <label
        htmlFor={name}
        className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon size={11} className="text-main/70" />}
          {label}
        </span>
      </label>

      <div className="relative group">
        {Icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-main dark:text-white/40 dark:group-focus-within:text-main">
            <Icon size={18} />
          </div>
        )}

        <Select
          id={name}
          mode="multiple"
          value={value}
          options={options}
          onChange={onChange}
          placeholder={placeholder}
          loading={loading}
          disabled={disabled}
          maxTagCount="responsive"
          allowClear
          className={clsx("order-filter-multiselect w-full", {
            "order-filter-multiselect--with-icon": Boolean(Icon),
          })}
          popupClassName="order-filter-multiselect-dropdown"
        />
      </div>
    </div>
  );
};

export default memo(FilterMultiSelect);
