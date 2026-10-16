import { useTranslation } from "react-i18next";
import { Calendar } from "./Calendar";
import { formatDay, normalizeISODay } from "./date/calendarMath";
import { DatePickerLayer, DateTrigger } from "./date/DatePickerParts";
import { useDatePicker } from "./date/useDatePicker";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  BITTA SANA — dizayn v2 (`.el-select` + `.el-cal`, `design/CODE-MAP.md` 2.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Maydon `DateRange` bilan bir xil: `Calendar` ikonka + «08.10.2026» (bo'sh — «Sanani tanlang»),
 *  o'ngda chevron yoki × «Sanani tozalash». Maket: `superadmin-notifications-sms-campaign-confirm-dialog`
 *  («Oxirgi buyurtma — dan: 01.07.2026»), `manager-branch-dashboard-main` («Sana: 08.10.2026»).
 *  Panel — bitta oy (`Calendar`), kun bosilishi bilan qo'llanadi va yopiladi; telefonda pastki varaqa.
 *
 *  Qiymat — `"YYYY-MM-DD"` (bo'sh — `""`).
 */

export type DateInputProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Bo'sh maydon matni (sukut «Sanani tanlang»). */
  placeholder?: string;
  min?: string;
  max?: string;
  /** × tugmasi (sukut `true`). */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  id?: string;
  /** `Field` siz nom (sukut «Sana») — tugma nomi «Sana: 08.10.2026». */
  "aria-label"?: string;
  /** Panel nomi (sukut «Sanani tanlash»). */
  dialogLabel?: string;
  today?: string;
  className?: string;
  triggerClassName?: string;
};

/**
 * Dizayn v2 bitta sana maydoni.
 *
 *   <Field label="Boshlanish" labelAs="span"><DateInput value={from} onChange={setFrom} max={to} /></Field>
 */
export const DateInput = ({
  value,
  onChange,
  placeholder,
  min,
  max,
  clearable = true,
  disabled,
  invalid,
  required,
  id,
  "aria-label": ariaLabel,
  dialogLabel,
  today,
  className,
  triggerClassName,
}: DateInputProps) => {
  const { t } = useTranslation("ui");
  const picker = useDatePicker();
  const { close } = picker;
  const day = normalizeISODay(value);
  const text = day ? formatDay(day) : (placeholder ?? t("date.datePlaceholder"));

  return (
    <>
      <DateTrigger
        picker={picker}
        text={text}
        empty={!day}
        spoken={text}
        ariaLabel={ariaLabel ?? t("date.dateLabel")}
        clearLabel={t("date.clearDate")}
        onClear={clearable ? () => onChange("") : undefined}
        id={id}
        invalid={invalid}
        disabled={disabled}
        required={required}
        className={className}
        triggerClassName={triggerClassName}
      />
      <DatePickerLayer picker={picker} label={dialogLabel ?? t("date.datePanelLabel")} popoverClassName="w-[300px]">
        {() => (
          <Calendar
            mode="single"
            start={day}
            onSelect={(next) => {
              onChange(next);
              close(true);
            }}
            min={min}
            max={max}
            today={today}
            autoFocus
          />
        )}
      </DatePickerLayer>
    </>
  );
};
