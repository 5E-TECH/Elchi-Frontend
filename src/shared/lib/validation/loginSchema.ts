import * as yup from "yup";

export const loginSchema = yup.object().shape({
  username: yup.string().required("Username shart"),
  password: yup
    .string()
    .required("Parol shart")
    .min(4, "Parol kamida 6 ta belgidan iborat bo'lishi kerak"),
});