import * as yup from "yup";
import i18n from "../../../i18n";
import { isCompleteUzbekistanPhone } from "../../../shared/lib/phone";

export const branchEditSchema = yup.object({
  name: yup.string().min(2, i18n.t("branches:validation.minName")).required(i18n.t("branches:validation.name")),
  parent_id: yup.string().default("").defined().when("type", {
    is: (type: string) => type !== "HQ",
    then: (schema) => schema.required(i18n.t("branches:validation.parent")),
    otherwise: (schema) => schema.optional(),
  }),
  type: yup
    .string<"HQ" | "CITY" | "REGIONAL" | "DISTRICT">()
    .oneOf(["HQ", "CITY", "REGIONAL", "DISTRICT"])
    .required(i18n.t("branches:validation.type")),
  code: yup.string().trim().required(i18n.t("branches:validation.code")),
  phone_number: yup
    .string()
    .required(i18n.t("branches:validation.phone"))
    .test("uz-phone", i18n.t("branches:validation.phoneFormat"), isCompleteUzbekistanPhone),
  address: yup.string().required(i18n.t("branches:validation.address")),
});
