import { createContext, useContext } from "react";

/**
 * MAYDON KONTEKSTI — `Field` (yorliq, ko'rsatma, xato) va uning ichidagi boshqaruv (`TextInput`,
 * `Select`, `DateRange` …) orasidagi `id` bog'lanishi.
 *
 * `Field` `id` larni yaratadi; boshqaruv `useFieldControl()` bilan ularni oladi va o'ziga qo'yadi:
 * `id` (yorliq `htmlFor`), `aria-describedby` (ko'rsatma yoki xato), `aria-invalid`,
 * `aria-errormessage`, `aria-required`, `disabled`, `readOnly`. Tugma ko'rinishidagi boshqaruv
 * (Select, DateRange: `<button>`) `aria-labelledby={labelId}` ni ham oladi.
 */
export type FieldContextValue = {
  /** Boshqaruv `id` si (yorliq `htmlFor`). */
  controlId: string;
  /** Yorliq elementining `id` si (`aria-labelledby` uchun). */
  labelId: string;
  /** Ko'rsatma `id` si — ko'rsatma ko'rinib turgan bo'lsa (xato yo'q). */
  hintId: string | undefined;
  /** Xato matni `id` si — xato bo'lsa. */
  errorId: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Joriy `Field` konteksti (maydon `Field` ichida bo'lmasa — `null`). */
export const useFieldContext = () => useContext(FieldContext);

export type FieldControlOverrides = {
  id?: string;
  "aria-describedby"?: string;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
};

export type FieldControlProps = {
  id: string | undefined;
  /** `Field` yorlig'i `id` si (tugma ko'rinishidagi boshqaruv: `aria-labelledby`). */
  labelId: string | undefined;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-errormessage": string | undefined;
  "aria-required": true | undefined;
  invalid: boolean;
  disabled: boolean;
  readOnly: boolean;
};

const joinIds = (...ids: Array<string | undefined>) => ids.filter(Boolean).join(" ") || undefined;

/**
 * Boshqaruv atributlari: `Field` konteksti + o'zining props'lari (props ustun: `invalid`, `disabled` …).
 *
 *   const field = useFieldControl({ id, "aria-describedby": describedBy, invalid, disabled, readOnly });
 *   <input id={field.id} aria-describedby={field["aria-describedby"]} aria-invalid={field["aria-invalid"]} … />
 */
export const useFieldControl = (overrides: FieldControlOverrides = {}): FieldControlProps => {
  const field = useFieldContext();
  const invalid = overrides.invalid ?? field?.invalid ?? false;
  const errorId = invalid ? field?.errorId : undefined;
  return {
    id: overrides.id ?? field?.controlId,
    labelId: field?.labelId,
    "aria-describedby": joinIds(errorId ?? field?.hintId, overrides["aria-describedby"]),
    "aria-invalid": invalid ? true : undefined,
    "aria-errormessage": errorId,
    "aria-required": (overrides.required ?? field?.required) ? true : undefined,
    invalid,
    disabled: overrides.disabled ?? field?.disabled ?? false,
    readOnly: overrides.readOnly ?? field?.readOnly ?? false,
  };
};
