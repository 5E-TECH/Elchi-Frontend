import * as yup from "yup";
import i18n from "../../../i18n";
import { isCompleteUzbekistanPhone } from "../../../shared/lib/phone";

/**
 * `useForm({ context })` orqali beriladi. HQ (bosh ofis) filialining turi
 * qulflangan — backend uni o'zgartirishni 400 bilan rad etadi ("HQ filial
 * turini o'zgartirib bo'lmaydi") — va HQ'da yuqori filial bo'lmaydi. Shu sabab
 * `isHqBranch` bo'lsa "HQ tanlab bo'lmaydi" va "yuqori filial majburiy"
 * qoidalari o'tkazib yuboriladi. Kontekstsiz (oddiy filial) — qoidalar avvalgidek.
 */
export interface BranchEditSchemaContext {
  isHqBranch?: boolean;
}

export const branchEditSchema = yup.object({
  name: yup.string().min(2, i18n.t("branches:validation.minName")).required(i18n.t("branches:validation.name")),
  // HQ'dan boshqa HAR BIR tur uchun (PICKUP ham) yuqori filial majburiy —
  // backend yuqori filialsiz filialni saqlamaydi, PICKUP esa qopini aynan
  // yuqori filialiga jo'natadi.
  parent_id: yup.string().default("").defined().when(["type", "$isHqBranch"], {
    is: (_type: string, isHqBranch?: boolean) => !isHqBranch,
    then: (schema) => schema.required(i18n.t("branches:validation.parent")),
    otherwise: (schema) => schema.optional(),
  }),
  type: yup
    .string<"HQ" | "PICKUP" | "REGIONAL" | "HYBRID">()
    .oneOf(["HQ", "PICKUP", "REGIONAL", "HYBRID"])
    .when("$isHqBranch", {
      is: (isHqBranch?: boolean) => !isHqBranch,
      then: (schema) => schema.notOneOf(["HQ"], i18n.t("branches:validation.hqDisabled")),
    })
    .required(i18n.t("branches:validation.type")),
  code: yup.string().trim().required(i18n.t("branches:validation.code")),
  phone_number: yup
    .string()
    .required(i18n.t("branches:validation.phone"))
    .test("uz-phone", i18n.t("branches:validation.phoneFormat"), isCompleteUzbekistanPhone),
  address: yup.string().required(i18n.t("branches:validation.address")),
});
