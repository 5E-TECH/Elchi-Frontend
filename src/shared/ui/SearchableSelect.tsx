import { memo, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveFilterEmptyLabel, type AllOptionProp } from "../lib/selectPlaceholder";
import { Field } from "./primitives/Field";
import { Select } from "./primitives/Select";

/**
 * QIDIRUVLI TANLASH RO'YXATI — eski API, ichi dizayn v2 `Field` + `Select searchable`
 * (`.el-select` / `.el-options`, taxta `tizim-states-forms` 03 «Qidiruv bilan»): maydonning o'zi
 * qidiruvga aylanadi, mos qism qalin, topilmasa «Topilmadi».
 *
 * Xatti-harakati avvalgidek: qiymat — satr (bo'sh — `""`), `value=""` li variant ro'yxatga kirmaydi,
 * `placement="top"` — ro'yxat tepada. `size` va `surface` endi bitta v2 maydon (40 px, telefonda 44) —
 * e'tiborga olinmaydi.
 *
 * FILTR (ega qarori 2026-10-16; `allOption`, `value=""` li variant yoki «Barchasi»-simon namuna —
 * `shared/lib/selectPlaceholder.ts`): bo'sh maydonda «Barchasi» (maket `superadmin-orders-list`), qiymat
 * tanlangach maydonda × «Tozalash» — bosilsa `onChange("")`. Forma ro'yxati o'z namunasini saqlaydi.
 * Yangi kodda to'g'ridan-to'g'ri `<Field labelAs="span"><Select searchable /></Field>` ishlating.
 */
export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  label: string;
  /** Maydon `id` si (avvalgidek: `document.getElementById(name)`, tashqi `<label htmlFor>`). */
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** v1: 44 / 48 px. v2 da bitta o'lcham — e'tiborga olinmaydi. */
  size?: "sm" | "md";
  hideLabel?: boolean;
  /** v1 fon turi — v2 da bitta maydon foni, e'tiborga olinmaydi. */
  surface?: "default" | "search";
  /**
   * Ro'yxat qayerga ochiladi. Standart — pastga. Modal oxiridagi tanlovda "top" (sig'masa v2 ro'yxat
   * o'zi ham ag'dariladi).
   */
  placement?: "bottom" | "top";
  /**
   * Filtr: bo'sh qiymat (`""`) — «hammasi». `true` — bo'sh maydonda «Barchasi», qiymat tanlangach × «Tozalash»;
   * satr — «Barchasi» o'rniga shu matn; `false` — filtr emas. Berilmasa: `value=""` li variant yoki
   * «Barchasi»-simon `placeholder` bo'lsa — filtr.
   */
  allOption?: AllOptionProp;
}

const SearchableSelect = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  icon,
  loading = false,
  disabled = false,
  hideLabel = false,
  placement = "bottom",
  allOption,
}: SearchableSelectProps) => {
  const { t } = useTranslation("ui");
  const normalizedOptions = useMemo(() => options.filter((option) => option.value !== ""), [options]);
  const filterEmptyLabel = resolveFilterEmptyLabel({
    allOption,
    emptyOptionLabel: options.find((option) => option.value === "")?.label,
    placeholder,
    hideLabel,
    allWord: t("select.all"),
  });

  return (
    <Field id={name} label={label} hideLabel={hideLabel} labelAs="span">
      <Select
        searchable
        options={normalizedOptions}
        value={value || null}
        onChange={(next) => onChange(next ?? "")}
        placeholder={filterEmptyLabel ?? placeholder ?? t("select.placeholder")}
        clearable={filterEmptyLabel !== null}
        inlineLabel={hideLabel && filterEmptyLabel !== null ? label : undefined}
        icon={icon}
        loading={loading}
        disabled={disabled}
        placement={placement}
      />
    </Field>
  );
};

export default memo(SearchableSelect);
