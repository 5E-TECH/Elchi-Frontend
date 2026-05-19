import * as yup from "yup";
import i18n from "../../../i18n";

export const branchSettingSchema = yup.object({
  key: yup.string().required(i18n.t("branches:settings.keyRequired")),
  value: yup.string().required(i18n.t("branches:settings.valueRequired")),
});
