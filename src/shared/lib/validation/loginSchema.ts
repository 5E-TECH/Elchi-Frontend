import * as yup from "yup";
import type { TFunction } from "i18next";

export const createLoginSchema = (t: TFunction<"auth">) =>
  yup.object().shape({
    phone_number: yup
      .string()
      .required(t("phoneRequired"))
      .matches(/^\+998 \d{2} \d{3} \d{2} \d{2}$/, t("phoneFormat")),
    password: yup
      .string()
      .required(t("passwordRequired"))
      .min(4, t("passwordMinLength")),
  });
