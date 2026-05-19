import * as yup from "yup";
import i18n from "../../../i18n";

export const addEmployeeSchema = yup.object({
  user_id: yup.string().required(i18n.t("branches:employee.selectUser")),
});
