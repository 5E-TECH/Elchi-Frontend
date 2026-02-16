import * as yup from "yup";

export const loginSchema = yup.object().shape({
  phone_number: yup
    .string()
    .required("Telefon raqam shart")
    .matches(/^\+998 \d{2} \d{3} \d{2} \d{2}$/, "Format: +998 90 123 45 67"),
  password: yup
    .string()
    .required("Parol shart")
    .min(4, "Parol kamida 4 ta belgidan iborat bo'lishi kerak"),
});