import * as yup from "yup";

export const notificationSchema = yup.object({
  market_id: yup
    .string()
    .matches(/^\d+$/, "Marketni tanlang")
    .required("Marketni tanlang"),
  group_id: yup.string().required("Group ID kiriting"),
  group_type: yup
    .string<"cancel" | "create">()
    .oneOf(["cancel", "create"])
    .required("Group turini tanlang"),
});
