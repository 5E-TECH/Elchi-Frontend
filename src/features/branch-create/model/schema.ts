import * as yup from "yup";
import i18n from "../../../i18n";
import { isCompleteUzbekistanPhone } from "../../../shared/lib/phone";

export const branchSchema = yup.object({
  name: yup.string().min(2, i18n.t("branches:validation.minName")).required(i18n.t("branches:validation.name")),
  // Yuqori filial HAR BIR tur uchun majburiy — PICKUP ham qopini yuqori
  // filialiga jo'natadi, backend esa HQ'dan boshqa filialni yuqori filialsiz
  // yaratmaydi.
  parent_id: yup.string().default("").defined().required(i18n.t("branches:validation.parent")),
  type: yup
    .string<"PICKUP" | "REGIONAL" | "HYBRID">()
    .oneOf(["PICKUP", "REGIONAL", "HYBRID"])
    .required(i18n.t("branches:validation.type")),
  code: yup.string().trim().required(i18n.t("branches:validation.code")),
  phone_number: yup
    .string()
    .required(i18n.t("branches:validation.phone"))
    .test("uz-phone", i18n.t("branches:validation.phoneFormat"), isCompleteUzbekistanPhone),
  region_id: yup.string().required(i18n.t("branches:validation.region")),
  district_id: yup.string().required(i18n.t("branches:validation.district")),
  address: yup.string().required(i18n.t("branches:validation.address")),
});
