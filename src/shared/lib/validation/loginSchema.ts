import type { TFunction } from "i18next";
import type { FieldErrors, Resolver, ResolverResult } from "react-hook-form";
import { getUzbekistanPhoneDigits } from "../phone";

/**
 * Kirish formasi tekshiruvi. Telefon qiymati — `TextInput mode="phone"` ko'rinishida: `+998XXXXXXXXX`
 * (bo'sh joysiz, 9 ta mahalliy raqam). Faqat `+998` (raqam yozilmagan) — bo'sh: `phoneRequired`;
 * chala raqam — `phoneFormat`. Parol — majburiy, kamida 4 belgi.
 *
 * `yup` siz (rzzxMItN): ikki maydon uchun kutubxona (≈14 KB gzip) kirish sahifasini sekin tarmoqda kechiktirardi.
 */
export const LOGIN_PHONE_PATTERN = /^\+998\d{9}$/;
export const LOGIN_PASSWORD_MIN_LENGTH = 4;

export interface LoginFormValues {
  phone_number: string;
  password: string;
}

export const createLoginResolver =
  (t: TFunction<"auth">): Resolver<LoginFormValues> =>
  (values): ResolverResult<LoginFormValues> => {
    const phone = getUzbekistanPhoneDigits(values.phone_number ?? "").length === 0 ? "" : (values.phone_number ?? "");
    const password = values.password ?? "";
    const errors: FieldErrors<LoginFormValues> = {};

    if (!phone) errors.phone_number = { type: "required", message: t("phoneRequired") };
    else if (!LOGIN_PHONE_PATTERN.test(phone)) errors.phone_number = { type: "matches", message: t("phoneFormat") };

    if (!password) errors.password = { type: "required", message: t("passwordRequired") };
    else if (password.length < LOGIN_PASSWORD_MIN_LENGTH) {
      errors.password = { type: "min", message: t("passwordMinLength") };
    }

    if (Object.keys(errors).length > 0) return { values: {}, errors };
    return { values: { phone_number: phone, password }, errors: {} };
  };
