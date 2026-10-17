import * as yup from "yup";

/** Xato matnlari — `notifications` nomlar fazosidagi kalitlar (oynada `t()` bilan tarjima qilinadi). */
export const notificationEditSchema = yup.object({
  market_id: yup
    .string()
    .matches(/^\d+$/, "telegramGroups.create.marketRequired")
    .required("telegramGroups.create.marketRequired"),
  group_id: yup.string().trim().required("telegramGroups.editDialog.groupIdRequired"),
  group_type: yup
    .string<"cancel" | "create">()
    .oneOf(["cancel", "create"])
    .required(),
});
