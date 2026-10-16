import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { LucideIcon } from "lucide-react";
import { setFilterValue } from "../model/filterSlice";
import { useQueryParams } from "../lib/useQueryParams";
import { resolveFilterEmptyLabel, type AllOptionProp } from "../lib/selectPlaceholder";
import type { RootState } from "../../app/config/store";
import { Field } from "./primitives/Field";
import { Select, type SelectOption } from "./primitives/Select";

/**
 * FILTR TANLASH RO'YXATI — eski API (Redux + URL sinxroni), ichi dizayn v2 `Field` + `Select`
 * (`.el-select` / `.el-options`, taxta `tizim-states-forms` 03): ↑ ↓ Home End, harf yozib o'tish,
 * Enter / Esc, tanlangan qatorda `Check`.
 *
 * Xatti-harakati avvalgidek: `value=""` li variant ro'yxatga kirmaydi; `useRedux` + `reduxKey` — qiymat
 * `filterSlice` da va URL'da (`urlKey ?? reduxKey`, bo'sh qiymat — parametr olib tashlanadi).
 * `size` endi bitta v2 maydon (40 px, telefonda 44) — e'tiborga olinmaydi.
 *
 * FILTR (ega qarori 2026-10-16; `allOption`, `value=""` li variant, «Barchasi»-simon namuna yoki `useRedux` —
 * `shared/lib/selectPlaceholder.ts`): bo'sh maydonda «Barchasi» (yoki `value=""` li variant nomi), qiymat
 * tanlangach maydonda × «Tozalash» — bosilsa `onChange("")` (Redux va URL ham tozalanadi). Forma ro'yxati
 * (to'lov turi, karta …) o'z namunasini saqlaydi, × chiqmaydi.
 */
export interface FilterSelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface FilterSelectProps {
  label: string;
  /** Maydon `id` si (avvalgidek: `document.getElementById(name)`, tashqi `<label htmlFor>`). */
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** v1: 44 / 48 px. v2 da bitta o'lcham — e'tiborga olinmaydi. */
  size?: "sm" | "md";
  hideLabel?: boolean;
  useRedux?: boolean;
  reduxKey?: string;
  urlKey?: string;
  /**
   * Filtr: bo'sh qiymat (`""`) — «hammasi». `true` — bo'sh maydonda «Barchasi», qiymat tanlangach × «Tozalash»;
   * satr — «Barchasi» o'rniga shu matn; `false` — filtr emas. Berilmasa: `value=""` li variant,
   * «Barchasi»-simon `placeholder` yoki `useRedux` bo'lsa — filtr.
   */
  allOption?: AllOptionProp;
}

const FilterSelect = memo(
  ({
    label,
    name,
    value = "",
    onChange,
    options,
    placeholder,
    icon,
    loading = false,
    disabled = false,
    hideLabel = false,
    useRedux = false,
    reduxKey,
    urlKey,
    allOption,
  }: FilterSelectProps) => {
    const { t } = useTranslation("ui");
    const dispatch = useDispatch();
    const { setParam, removeParam } = useQueryParams();
    const reduxValue = useSelector((state: RootState) =>
      useRedux && reduxKey ? (state.filter[reduxKey] as string) || "" : "",
    );
    const currentValue = useRedux ? reduxValue : value;

    const selectOptions = useMemo<SelectOption[]>(
      () =>
        options
          .filter((option) => option.value !== "")
          .map((option) => ({ value: option.value, label: option.label, icon: option.icon })),
      [options],
    );
    const filterEmptyLabel = resolveFilterEmptyLabel({
      allOption,
      emptyOptionLabel: options.find((option) => option.value === "")?.label,
      placeholder,
      hideLabel,
      implicitFilter: useRedux && Boolean(reduxKey),
      allWord: t("select.all"),
    });

    const handleChange = (nextValue: string) => {
      if (useRedux && reduxKey) {
        dispatch(setFilterValue({ key: reduxKey, value: nextValue }));
        const paramKey = urlKey ?? reduxKey;
        if (nextValue) setParam(paramKey, nextValue);
        else removeParam(paramKey);
      }
      onChange?.(nextValue);
    };

    return (
      <Field id={name} label={label} hideLabel={hideLabel} labelAs="span">
        <Select
          options={selectOptions}
          value={currentValue || null}
          onChange={(next) => handleChange(next ?? "")}
          placeholder={filterEmptyLabel ?? placeholder ?? t("select.placeholder")}
          clearable={filterEmptyLabel !== null}
          inlineLabel={hideLabel && filterEmptyLabel !== null ? label : undefined}
          icon={icon}
          loading={loading}
          disabled={disabled}
        />
      </Field>
    );
  },
);

FilterSelect.displayName = "FilterSelect";

export default FilterSelect;
