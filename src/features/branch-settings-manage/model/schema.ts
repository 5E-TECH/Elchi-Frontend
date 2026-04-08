import * as yup from "yup";

export const branchSettingSchema = yup.object({
  key: yup.string().required("Kalit nomini kiriting"),
  value: yup.string().required("Qiymatni kiriting"),
});
