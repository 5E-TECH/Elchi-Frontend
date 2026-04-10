import * as yup from "yup";

export const addEmployeeSchema = yup.object({
  user_id: yup.string().required("Foydalanuvchini tanlang"),
});
