import type { CreateBranchDto } from "./types";

/**
 * Filial yaratish so'rovi.
 *
 * ⚠️ Ilgari PICKUP uchun formada tanlangan yuqori filial saqlashda
 * `parent_id: ""` bilan almashtirib yuborilardi. Backend esa HQ'dan boshqa har
 * qanday filial uchun yuqori filialni majburiy talab qiladi — PICKUP o'z
 * qopini (transfer batch) aynan yuqori filialiga jo'natadi. Natijada PICKUP'ni
 * ekrandan umuman yaratib bo'lmasdi: 400 "parent_id must be a number string".
 * Endi tanlangan yuqori filial har bir tur uchun o'zgarishsiz yuboriladi.
 */
export const buildCreateBranchPayload = (
  values: CreateBranchDto,
): Omit<CreateBranchDto, "manager_id"> => ({
  ...values,
  type: String(values.type).toUpperCase() as CreateBranchDto["type"],
  code: values.code.trim(),
  parent_id: String(values.parent_id ?? "").trim(),
});
