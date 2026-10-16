import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveFilterEmptyLabel } from "../lib/selectPlaceholder";
import { Field } from "./primitives/Field";
import { Select } from "./primitives/Select";

/**
 * KO'P TANLOVLI FILTR — eski API, ichi dizayn v2 `Field` + `Select multiple`
 * (taxta `tizim-states-forms` 03 «Ko'p tanlov»): tanlanganlar maydon ichida belgi (2 tasi ko'rinadi,
 * qolgani «+N»), har birini × bilan olib tashlash, × — hammasini tozalash; ro'yxat ochiq qoladi,
 * pastida «N ta tanlangan · Tozalash».
 *
 * Qiymat avvalgidek satrlar massivi (bo'sh — `[]` = hammasi). Doim filtr (ega qarori 2026-10-16): bo'sh maydonda
 * «Barchasi» (maket `superadmin-orders-list` «Holat»); `placeholder` faqat «Barcha …» ko'rinishida bo'lsa ishlatiladi.
 * Yangi kodda to'g'ridan-to'g'ri `<Field labelAs="span"><Select multiple clearable /></Field>` ishlating.
 */
export interface FilterMultiSelectOption {
  value: string;
  label: string;
}

interface FilterMultiSelectProps {
  label: string;
  /** Maydon `id` si (avvalgidek: `document.getElementById(name)`, tashqi `<label htmlFor>`). */
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: FilterMultiSelectOption[];
  /** Filtr namunasi — faqat «Barcha …» ko'rinishida («Barcha holatlar»); aks holda «Barchasi». */
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
  placeholder,
  icon,
  loading = false,
  disabled = false,
}: FilterMultiSelectProps) => {
  const { t } = useTranslation("ui");
  const emptyLabel =
    resolveFilterEmptyLabel({ placeholder, implicitFilter: true, allWord: t("select.all") }) ?? t("select.all");

  return (
    <Field id={name} label={label} labelAs="span">
      <Select
        multiple
        clearable
        options={options}
        value={value}
        onChange={onChange}
        placeholder={emptyLabel}
        icon={icon}
        loading={loading}
        disabled={disabled}
      />
    </Field>
  );
};

export default memo(FilterMultiSelect);
