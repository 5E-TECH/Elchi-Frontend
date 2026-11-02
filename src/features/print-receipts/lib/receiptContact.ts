import { formatPhone } from "../../../shared/lib/formatPhone";

/**
 * CHEKDAGI ALOQA MAYDONLARI (1mOjtOVC → HJ5sLHiz): jsPDF'siz yengil modul, statik import qilinadi.
 * T7 (QPq2C1co): «Muammo bo'lsa» — buyurtma viloyati logisti, u bo'lmasa umumiy raqam (`problem_contacts`, backend
 * tanlaydi). Operator va market raqami chekka chiqmaydi; raqam yo'q — o'ng qism chizilmaydi.
 */

export interface ReceiptContactSource {
  problem_contacts?: { phone?: string | null }[] | null;
}

/**
 * Bo'sh joy tutuvchi qiymat: faqat chiziqcha / nuqta / pastki chiziq / bo'shliqdan iborat («-», «—», «–», «...», «…»,
 * «_») yoki «null» / «undefined» / «n/a» matni — chekda chiqmaydi (TZ F3: «-» / «—» chop etilmaydi).
 */
const PLACEHOLDER = /^(?:[\s\-\u2010-\u2015\u2212_.…]*|null|undefined|n\/a)$/iu;

/** Qiymat matni (qirqilgan); bo'sh joy tutuvchi yoki matn bo'lmasa — `""`. */
export const cleanReceiptValue = (value: unknown): string => {
  const text =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : "";
  return PLACEHOLDER.test(text) ? "" : text;
};

/**
 * Chek telefoni: «+998 90 123 45 67» (`formatPhone`, dizayn v2 §7); xorijiy — o'zicha. Bo'sh, bo'sh joy tutuvchi
 * («-», «—») yoki birorta raqami yo'q qiymat — `""` (qator chiqmaydi, «—» emas).
 */
export const formatReceiptPhone = (value?: string | null) => {
  const raw = cleanReceiptValue(value);
  return raw && /\d/.test(raw) ? formatPhone(raw) : "";
};

/** «Muammo bo'lsa» raqamlari (`problem_contacts`), takrorsiz. Hech biri yo'q — `[]` (o'ng qism chizilmaydi). */
export const getReceiptContactPhones = (order: ReceiptContactSource): string[] => {
  const phones = (order.problem_contacts ?? [])
    .map((contact) => formatReceiptPhone(contact?.phone))
    .filter(Boolean);
  return Array.from(new Set(phones));
};

/** Bitta satr («…, …»): eski chaqiruvlar uchun. Bo'sh — `""`. */
export const getReceiptContactPhone = (order: ReceiptContactSource) =>
  getReceiptContactPhones(order).join(", ");

/** Kuryer / haydovchi qatori: «Ism · telefon»; ikkalasi yo'q — `""` (qator chiqmaydi). */
export const formatReceiptPerson = (
  person?: { name?: string | null; phone_number?: string | null } | null,
) =>
  [cleanReceiptValue(person?.name), formatReceiptPhone(person?.phone_number)]
    .filter(Boolean)
    .join(" · ");
