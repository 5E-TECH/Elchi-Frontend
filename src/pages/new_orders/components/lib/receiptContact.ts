/**
 * 1mOjtOVC: chek maydonlari — jsPDF'siz yengil modul (termal 80 mm oynasi va yorliq PDF'i ikkalasi
 * ishlatadi; `printLabelPdf` lazy yuklanadi, bu modul esa statik import qilinishi mumkin).
 */

export interface ReceiptContactSource {
  operator_phone?: string | null;
  secondary_operator_phone?: string | null;
  market?: { phone_number?: string | null } | null;
  logist?: { phone_number?: string | null } | null;
  courier?: { phone_number?: string | null } | null;
}

const clean = (value?: string | null) => (typeof value === "string" ? value.trim() : "");

/** `+998 (90) 123-45-67` (12 yoki 9 raqam); boshqasi — o'zicha. */
export const formatReceiptPhone = (value?: string | null) => {
  const raw = clean(value);
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length === 9 && (digits.length === 9 || digits.length === 12)) {
    return `+998 (${local.slice(0, 2)}) ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7, 9)}`;
  }
  return raw;
};

/**
 * «Muammo bo'lsa» raqami (maket `tizim-receipts` 10-band): operator telefoni (+ ikkinchi operator
 * raqami), u bo'lmasa — market telefoni, keyin logist / kuryer. Hech biri yo'q — `""`.
 */
export const getReceiptContactPhone = (order: ReceiptContactSource) => {
  const operators = [clean(order.operator_phone), clean(order.secondary_operator_phone)]
    .filter(Boolean)
    .map(formatReceiptPhone);
  if (operators.length > 0) return Array.from(new Set(operators)).join(", ");
  const fallback =
    clean(order.market?.phone_number) ||
    clean(order.logist?.phone_number) ||
    clean(order.courier?.phone_number);
  return fallback ? formatReceiptPhone(fallback) : "";
};

/** Kuryer / haydovchi qatori: «Ism · telefon»; ikkalasi yo'q — `""` (qator chiqmaydi). */
export const formatReceiptPerson = (person?: { name?: string | null; phone_number?: string | null } | null) =>
  [clean(person?.name), formatReceiptPhone(person?.phone_number)].filter(Boolean).join(" · ");
