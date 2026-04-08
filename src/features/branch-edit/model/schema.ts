import * as yup from "yup";

export const branchEditSchema = yup.object({
  name: yup.string().min(2, "Kamida 2 ta belgi").required("Filial nomini kiriting"),
  region_id: yup.string().required("Viloyatni tanlang"),
  district_id: yup.string().required("Tumanni tanlang"),
  address: yup.string().required("Manzilni kiriting"),
  status: yup.string<"active" | "inactive">().oneOf(["active", "inactive"]).required("Holat tanlang"),
});
