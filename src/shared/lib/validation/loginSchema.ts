import * as yup from "yup";
import type { TFunction } from "i18next";
import { getUzbekistanPhoneDigits } from "../phone";

/**
 * Kirish formasi tekshiruvi. Telefon qiymati — `TextInput mode="phone"` ko'rinishida: `+998XXXXXXXXX`
 * (bo'sh joysiz, 9 ta mahalliy raqam). Faqat `+998` (raqam yozilmagan) — bo'sh: `phoneRequired`;
 * chala raqam — `phoneFormat`.
 */
export const LOGIN_PHONE_PATTERN = /^\+998\d{9}$/;

export const createLoginSchema = (t: TFunction<"auth">) =>
  yup.object().shape({
    phone_number: yup
      .string()
      .transform((value: unknown) =>
        typeof value === "string" && getUzbekistanPhoneDigits(value).length === 0 ? "" : value,
      )
      .required(t("phoneRequired"))
      .matches(LOGIN_PHONE_PATTERN, t("phoneFormat")),
    password: yup
      .string()
      .required(t("passwordRequired"))
      .min(4, t("passwordMinLength")),
  });
