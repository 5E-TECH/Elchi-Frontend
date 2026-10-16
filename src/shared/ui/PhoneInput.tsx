import { memo, type FocusEventHandler } from "react";
import { UZBEKISTAN_PHONE_PREFIX } from "../lib/phone";
import { TextInput } from "./primitives/TextInput";

/**
 * TELEFON MAYDONI — eski API (react-hook-form `Controller` bilan), ichi dizayn v2 `TextInput mode="phone"`
 * (`.el-input`, taxta `tizim-states-forms` 02 «Telefon raqam»): `+998` o'zgarmaydi, «90 123 45 67»
 * ko'rinishida bo'linadi, kursor sakramaydi.
 *
 * Qiymat avvalgidek `+998901234567` (`toUzbekistanPhoneValue`); bo'sh — `+998`.
 * Yangi kodda to'g'ridan-to'g'ri `<Field><TextInput mode="phone" /></Field>` ishlating.
 */
interface PhoneInputProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
}

const PhoneInput = ({
  name,
  value = UZBEKISTAN_PHONE_PREFIX,
  onChange,
  onBlur,
  placeholder = "90 123 45 67",
  error = false,
  disabled = false,
}: PhoneInputProps) => (
  <TextInput
    mode="phone"
    name={name}
    value={value}
    onValueChange={onChange}
    onBlur={onBlur}
    placeholder={placeholder}
    invalid={error}
    disabled={disabled}
  />
);

export default memo(PhoneInput);
