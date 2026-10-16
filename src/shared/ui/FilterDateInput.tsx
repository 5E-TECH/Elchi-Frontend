import { memo } from "react";
import { DateInput } from "./primitives/DateInput";
import { Field } from "./primitives/Field";

/**
 * v1 API (yorliqli bitta sana filtri) — ichi dizayn v2: `Field` (yorliq ustida) + `DateInput` (3-bosqich).
 * Yangi kodda `<Field label labelAs="span"><DateInput … /></Field>` ni to'g'ridan-to'g'ri yozing.
 */
interface FilterDateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  /**
   * @deprecated v1: kalendarni doim pastda ochish. v2 popover maydon ostida ochiladi va joy bo'lmasagina
   * tepaga ag'dariladi (telefonda — pastki varaqa), shuning uchun e'tiborga olinmaydi.
   */
  placement?: "auto" | "bottom";
}

const FilterDateInput = ({ label, value, onChange, minDate, maxDate }: FilterDateInputProps) => (
  // `labelAs="span"`: yorliq bosilganda kalendar ochilib ketmaydi; nom — `aria-labelledby` (yorliq + sana).
  <Field label={label} labelAs="span">
    <DateInput value={value} onChange={onChange} min={minDate} max={maxDate} />
  </Field>
);

export default memo(FilterDateInput);
