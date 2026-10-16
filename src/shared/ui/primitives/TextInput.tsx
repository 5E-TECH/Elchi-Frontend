import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Check, CircleCheck, Copy, Lock, Phone, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "../../lib/clipboard";
import { cx } from "../../lib/cx";
import { keepDigitCaret, toDigits } from "../../lib/digitsInput";
import { CURRENCY_LABEL, formatNumberLocalized, resolveMoneyLanguage } from "../../lib/formatMoney";
import {
  formatUzbekistanPhoneLocal,
  getUzbekistanPhoneDigits,
  keepPhoneCaretAfterChange,
  toUzbekistanPhoneValue,
  UZBEKISTAN_PHONE_PREFIX,
} from "../../lib/phone";
import { ButtonIcon, type IconSlot } from "./Button";
import { useFieldControl } from "./fieldContext";
import { IconButton } from "./IconButton";
import { useMergedRefs } from "./overlay/mergeRefs";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  MATN MAYDONI — dizayn v2 (`.el-input` · `.el-input-lg` · `.el-search` · `.el-textarea`,
 *  `design/CODE-MAP.md` 2.2, taxta `tizim-states-forms` 01–02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  O'lchamlar: md 40 (r 10, 14px) · lg 48 (r 12, 15px — kuryer ekranlari). Telefonda (< 768) md 44 px,
 *  shrift 16 px (iOS fokusda sahifani kattalashtirmasin — `src/test/inputFontGuard.test.ts`).
 *
 *  Holatlar (`tizim-states-forms` 01): bo'sh · kursor ustida (chegara `text-subtle`) · fokus (chegara
 *  `action` + 3 px `focus` halqa, oraliqsiz) · to'ldirilgan · xato (chegara `danger`, fokusda `danger-soft`
 *  halqa; matn — `Field error`) · muvaffaqiyat (chegara `success` + `CircleCheck`) · o'chirilgan
 *  (`sunken` fon, `text-subtle` matn, `Lock`) · faqat o'qish (`sunken` fon, matn to'liq kontrastda,
 *  `copyable` — «nusxa olish» tugmasi).
 *
 *  Turlar (`mode`):
 *    text    — oddiy (sukut); `type` ni o'zingiz bering (`email`, `password` …);
 *    search  — `.el-search`: chapda `Search`, yozilganda o'ngda × («Qidiruvni tozalash», fokus maydonda
 *              qoladi), Enter — `onSearch`, Esc — tozalash (matn bo'lsa), `type="search"`;
 *    phone   — `+998` o'zgarmaydi, «90 123 45 67» ko'rinishida bo'linadi; qiymat `+998901234567`
 *              (`PhoneInput` bilan bir xil: `toUzbekistanPhoneValue`), kursor sakramaydi;
 *    number  — faqat raqamlar (`inputMode="numeric"`), qiymat — raqamlar satri;
 *    money   — mingliklar bilan («1 545 000»), qiymat — raqamlar satri («1545000»), o'ngda valyuta
 *              (uz so'm · ru сум · en UZS; `suffix={null}` — yashirish).
 *  Ko'p qatorli (`multiline`) — `.el-textarea`: kamida 88 px, bo'yiga cho'ziladi.
 *
 *  Yorliq, ko'rsatma va xato — `Field` (id lar avtomatik ulanadi). `Field` siz ishlatilsa —
 *  `aria-label` bering.
 */

export type TextInputSize = "md" | "lg";
export type TextInputMode = "text" | "search" | "phone" | "number" | "money";

type CommonProps = {
  /** Xato holati (odatda `Field error` dan keladi). */
  invalid?: boolean;
  /** Muvaffaqiyat: yashil chegara + `CircleCheck` (tekshiruvdan o'tgan qiymat). */
  success?: boolean;
  /** Yangi qiymat (formatlangan turlarda — saqlanadigan ko'rinishda: raqamlar yoki `+998…`). */
  onValueChange?: (value: string) => void;
};

type InputOnlyProps = {
  multiline?: false;
  /** md 40 (sukut) · lg 48 (`.el-input-lg`). */
  size?: TextInputSize;
  mode?: TextInputMode;
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Chapdagi ikonka (lucide). `search` va `phone` da o'zi bor. */
  icon?: IconSlot;
  /** O'ngdagi qo'shimcha (matn yoki element), masalan «ta». `money` da sukut — valyuta; `null` — yo'q. */
  suffix?: ReactNode;
  /** Yozilgan bo'lsa o'ngda × tugmasi (`search` da sukut `true`). */
  clearable?: boolean;
  /** × tugmasi nomi (sukut: qidiruvda «Qidiruvni tozalash», boshqasida «Tozalash»). */
  clearLabel?: string;
  /** × bosilganda (qiymat bo'sh satr bilan `onValueChange` dan keyin). */
  onClear?: () => void;
  /** `search`: Enter bosilganda joriy qiymat bilan. */
  onSearch?: (value: string) => void;
  /** Faqat o'qish holatida o'ngda «nusxa olish» tugmasi. */
  copyable?: boolean;
  /** Nusxa tugmasi nomi (sukut «Nusxa olish»; maketda «Ismdan nusxa olish»). */
  copyLabel?: string;
  /** Ichki `<input>` klassi (`className` — tashqi qutiga). */
  inputClassName?: string;
};

export type TextInputFieldProps = CommonProps &
  InputOnlyProps &
  Omit<ComponentProps<"input">, "size" | "value" | "defaultValue" | "onChange" | "prefix" | "children">;

export type TextAreaFieldProps = CommonProps & {
  multiline: true;
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
} & Omit<ComponentProps<"textarea">, "value" | "defaultValue" | "onChange" | "children">;

export type TextInputProps = TextInputFieldProps | TextAreaFieldProps;

/** Tashqi quti (maketdagi `.el-input`): chegara, fon, balandlik, fokus halqasi `focus-within` da. */
const BOX_BASE =
  "relative flex w-full min-w-0 items-center gap-2 border bg-input px-3 text-text " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none " +
  "focus-within:ring-3";

const BOX_SIZE: Record<TextInputSize, string> = {
  md: "h-10 rounded-[10px] max-md:h-11",
  lg: "h-12 rounded-xl",
};

const INPUT_TEXT: Record<TextInputSize, string> = {
  md: "text-base md:text-sm",
  lg: "text-base md:text-[15px]",
};

/**
 * Ichki `<input>`: shaffof, chegarasiz — ko'rinish tashqi qutida. Global `:focus-visible` konturi
 * (`index.css`, qatlamsiz) maydonda chiqmasin: maydon fokusi — chegara + 3 px halqa (`tizim-motion` 05,
 * «Maydonlarda — oraliqsiz»), shuning uchun `!`. `-my-px` — maydon qutining chegarasigacha cho'ziladi:
 * bosish maydoni to'liq 40/44/48 px (telefonda ≥ 44).
 */
const INPUT_BASE =
  "-my-px min-w-0 flex-1 self-stretch bg-transparent p-0 text-inherit placeholder:text-text-subtle " +
  "outline-none! disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none";

type BoxState = { invalid: boolean; success: boolean; disabled: boolean; readOnly: boolean };

/** Holat → chegara/fon klasslari (bir xususiyatga ikki klass tushmasin — JS'da tanlanadi). */
const boxStateClasses = ({ invalid, success, disabled, readOnly }: BoxState) =>
  cx(
    invalid
      ? "border-danger focus-within:ring-danger-soft"
      : success
        ? "border-success focus-within:border-action focus-within:ring-focus"
        : "border-border-strong focus-within:border-action focus-within:ring-focus",
    !invalid && !success && !disabled && "hover:border-text-subtle",
    disabled ? "cursor-not-allowed bg-sunken text-text-subtle" : readOnly ? "bg-sunken" : null,
  );

const TEXTAREA_BASE =
  "block min-h-[88px] w-full resize-y rounded-[10px] border bg-input px-3 py-2.5 text-base text-text md:text-sm " +
  "placeholder:text-text-subtle outline-none! focus:ring-3 transition-[background-color,border-color,box-shadow] " +
  "duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:resize-none";

const textareaStateClasses = ({ invalid, success, disabled, readOnly }: BoxState) =>
  cx(
    invalid
      ? "border-danger focus:ring-danger-soft"
      : success
        ? "border-success focus:border-action focus:ring-focus"
        : "border-border-strong focus:border-action focus:ring-focus",
    !invalid && !success && !disabled && "hover:border-text-subtle",
    disabled ? "bg-sunken text-text-subtle" : readOnly ? "bg-sunken" : null,
  );

/** Boshqariladigan yoki boshqarilmaydigan qiymat. */
const useValue = (value: string | undefined, defaultValue: string | undefined) => {
  const [inner, setInner] = useState(defaultValue ?? "");
  const controlled = value !== undefined;
  return [controlled ? value : inner, controlled, setInner] as const;
};

type TextAreaOwnProps = Omit<TextAreaFieldProps, "multiline">;
type SingleLineOwnProps = Omit<TextInputFieldProps, "multiline">;

const TextArea = ({
  invalid,
  success = false,
  onValueChange,
  value,
  defaultValue,
  onChange,
  id,
  disabled,
  readOnly,
  required,
  rows = 3,
  className,
  "aria-describedby": describedBy,
  ...rest
}: TextAreaOwnProps) => {
  const field = useFieldControl({ id, "aria-describedby": describedBy, invalid, disabled, readOnly, required });
  const [current, controlled, setInner] = useValue(value, defaultValue);
  return (
    <textarea
      {...rest}
      id={field.id}
      rows={rows}
      value={current}
      disabled={field.disabled}
      readOnly={field.readOnly}
      aria-describedby={field["aria-describedby"]}
      aria-invalid={field["aria-invalid"]}
      aria-errormessage={field["aria-errormessage"]}
      aria-required={field["aria-required"]}
      data-invalid={field.invalid || undefined}
      onChange={(event) => {
        if (!controlled) setInner(event.target.value);
        onChange?.(event);
        onValueChange?.(event.target.value);
      }}
      className={cx(
        TEXTAREA_BASE,
        textareaStateClasses({ invalid: field.invalid, success, disabled: field.disabled, readOnly: field.readOnly }),
        className,
      )}
    />
  );
};

/** Saqlanadigan qiymat → maydonda ko'rinadigan matn. */
const toDisplay = (mode: TextInputMode, value: string, language: string) => {
  if (mode === "phone") return formatUzbekistanPhoneLocal(value);
  if (mode === "money") {
    const digits = toDigits(value);
    return digits ? formatNumberLocalized(digits, { language }) : "";
  }
  return value;
};

/** Maydonga yozilgan matn → saqlanadigan qiymat. */
const fromInput = (mode: TextInputMode, raw: string) => {
  if (mode === "phone") return toUzbekistanPhoneValue(raw);
  if (mode === "money" || mode === "number") return toDigits(raw);
  return raw;
};

/** Qiymat bo'shmi (telefonda faqat `+998` — bo'sh). */
const isEmptyValue = (mode: TextInputMode, value: string) =>
  mode === "phone" ? getUzbekistanPhoneDigits(value).length === 0 : value.length === 0;

const SingleLine = ({
  size = "md",
  invalid,
  success = false,
  onValueChange,
  mode = "text",
  value,
  defaultValue,
  onChange,
  icon,
  suffix,
  clearable,
  clearLabel,
  onClear,
  onSearch,
  copyable = false,
  copyLabel,
  inputClassName,
  id,
  disabled,
  readOnly,
  required,
  className,
  ref,
  type,
  placeholder,
  onKeyDown,
  "aria-describedby": describedBy,
  ...rest
}: SingleLineOwnProps) => {
  const { t, i18n } = useTranslation("ui");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const field = useFieldControl({ id, "aria-describedby": describedBy, invalid, disabled, readOnly, required });
  const [current, controlled, setInner] = useValue(value, defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const setRefs = useMergedRefs(inputRef, ref);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const display = toDisplay(mode, current, language);
  const empty = isEmptyValue(mode, current);
  const canClear = (clearable ?? mode === "search") && !empty && !field.disabled && !field.readOnly;

  const emit = (next: string) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = fromInput(mode, event.target.value);
    if (mode === "phone") keepPhoneCaretAfterChange(event.target, formatUzbekistanPhoneLocal(next));
    if (mode === "money") keepDigitCaret(event.target, toDisplay(mode, next, language));
    onChange?.(event);
    emit(next);
  };

  const clear = () => {
    emit(mode === "phone" ? UZBEKISTAN_PHONE_PREFIX : "");
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || mode !== "search") return;
    if (event.key === "Enter" && onSearch) {
      event.preventDefault();
      onSearch(current);
    } else if (event.key === "Escape" && !empty && !field.readOnly && !field.disabled) {
      // Esc avval matnni tozalaydi; oyna/ro'yxat yopilmaydi (`defaultPrevented`).
      event.preventDefault();
      event.stopPropagation();
      clear();
    }
  };

  /** Quti bo'sh joyiga (ikonka, chekka) bosilsa ham fokus maydonga. */
  const focusFromBox = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target === inputRef.current || target.closest("button")) return;
    event.preventDefault();
    inputRef.current?.focus();
  };

  const leading =
    mode === "search" ? (
      <ButtonIcon icon={icon ?? Search} px={18} className="text-text-subtle" />
    ) : mode === "phone" ? (
      <>
        <span className="flex shrink-0 items-center gap-2">
          <ButtonIcon icon={icon ?? Phone} px={16} className="text-text-subtle" />
          <span className={cx("font-semibold", INPUT_TEXT[size])}>{UZBEKISTAN_PHONE_PREFIX}</span>
        </span>
        <span aria-hidden="true" className="ml-1.5 h-5 w-px shrink-0 bg-border" />
      </>
    ) : icon ? (
      <ButtonIcon icon={icon} px={18} className="text-text-subtle" />
    ) : null;

  const suffixNode = suffix === undefined && mode === "money" ? CURRENCY_LABEL[language] : suffix;

  let trailing: ReactNode = null;
  if (canClear) {
    trailing = (
      <IconButton
        label={clearLabel ?? t(mode === "search" ? "input.clearSearch" : "input.clear")}
        icon={X}
        size="sm"
        className="-mr-2 text-text-subtle max-md:-mr-3"
        onMouseDown={(event) => event.preventDefault()}
        onClick={clear}
      />
    );
  } else if (copyable && field.readOnly && !field.disabled) {
    const label = copied ? t("input.copied") : (copyLabel ?? t("input.copy"));
    trailing = (
      <IconButton
        label={label}
        icon={copied ? Check : Copy}
        size="sm"
        className="-mr-2 max-md:-mr-3"
        onClick={async () => setCopied(await copyToClipboard(display))}
      />
    );
  } else if (field.disabled) {
    trailing = <ButtonIcon icon={Lock} px={16} className="text-text-subtle" />;
  } else if (success && !field.invalid) {
    trailing = <ButtonIcon icon={CircleCheck} px={16} className="text-success-fg" />;
  }

  const numeric = mode === "phone" || mode === "number" || mode === "money";

  return (
    // Quti — bezak; klaviatura maydonning o'zida (bosish faqat fokusni maydonga o'tkazadi).
    <div
      data-text-input={mode}
      data-size={size}
      data-invalid={field.invalid || undefined}
      onMouseDown={focusFromBox}
      className={cx(
        BOX_BASE,
        BOX_SIZE[size],
        boxStateClasses({ invalid: field.invalid, success, disabled: field.disabled, readOnly: field.readOnly }),
        className,
      )}
    >
      {leading}
      <input
        {...rest}
        ref={setRefs}
        id={field.id}
        type={mode === "search" ? "search" : mode === "phone" ? "tel" : numeric ? "text" : (type ?? "text")}
        inputMode={mode === "search" ? "search" : numeric ? "numeric" : rest.inputMode}
        enterKeyHint={mode === "search" ? "search" : rest.enterKeyHint}
        autoComplete={mode === "phone" ? "off" : rest.autoComplete}
        placeholder={placeholder ?? (mode === "phone" ? t("input.phonePlaceholder") : undefined)}
        value={display}
        disabled={field.disabled}
        readOnly={field.readOnly}
        aria-describedby={field["aria-describedby"]}
        aria-invalid={field["aria-invalid"]}
        aria-errormessage={field["aria-errormessage"]}
        aria-required={field["aria-required"]}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cx(INPUT_BASE, INPUT_TEXT[size], numeric && "tabular-nums", inputClassName)}
      />
      {suffixNode !== null && suffixNode !== undefined && suffixNode !== false ? (
        <span className="shrink-0 text-sm text-text-muted">{suffixNode}</span>
      ) : null}
      {trailing}
    </div>
  );
};

/**
 * Dizayn v2 matn maydoni.
 *
 *   <Field label="Mijoz ismi" required error={errors.name}>
 *     <TextInput value={name} onValueChange={setName} placeholder="Ism kiriting" />
 *   </Field>
 *   <TextInput mode="search" aria-label="Buyurtmalarni qidirish" value={q} onValueChange={setQ} />
 *   <Field label="Telefon raqam" required hint="9 ta raqam, kod avtomatik">
 *     <TextInput mode="phone" value={phone} onValueChange={setPhone} />
 *   </Field>
 *   <Field label="Izoh" optional><TextInput multiline value={note} onValueChange={setNote} /></Field>
 */
export const TextInput = ({ multiline, ...props }: TextInputProps) =>
  multiline ? <TextArea {...(props as TextAreaOwnProps)} /> : <SingleLine {...(props as SingleLineOwnProps)} />;
