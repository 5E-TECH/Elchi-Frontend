import * as yup from "yup";

export const branchSchema = yup.object({
  name: yup.string().min(2, "Kamida 2 ta belgi").required("Filial nomini kiriting"),
  phone_number: yup.string().required("Telefon raqamini kiriting"),
  region_id: yup.string().required("Viloyatni tanlang"),
  district_id: yup.string().required("Tumanni tanlang"),
  address: yup.string().required("Manzilni kiriting"),
  status: yup.string<"active" | "inactive">().oneOf(["active", "inactive"]).required("Holat tanlang"),
  manager_id: yup.string().required("Mas'ul xodimni tanlang"),
});
