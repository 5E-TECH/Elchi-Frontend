import * as yup from "yup";

/** Xato matnlari — `notificationGroups` nomlar fazosidagi kalitlar (oynada `t()` bilan tarjima qilinadi). */
export const notificationEditSchema = yup.object({
  market_id: yup
    .string()
    .matches(/^\d+$/, "form.errors.market")
    .required("form.errors.market"),
  group_id: yup.string().trim().required("edit.groupIdRequired"),
  group_type: yup
    .string<"cancel" | "create">()
    .oneOf(["cancel", "create"])
    .required(),
});
