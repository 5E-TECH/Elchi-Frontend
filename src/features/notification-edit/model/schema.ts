import * as yup from "yup";

export const notificationEditSchema = yup.object({
  user_id: yup.string().required("Foydalanuvchini tanlang"),
  chat_id: yup
    .string()
    .matches(/^\d+$/, "Faqat raqam kiriting")
    .required("Chat ID kiriting"),
  status: yup
    .string<"active" | "inactive">()
    .oneOf(["active", "inactive"])
    .required("Holat tanlang"),
});
