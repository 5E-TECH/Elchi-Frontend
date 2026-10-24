import QRCode from "qrcode";
import { getBackendMessage, getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * MAHSULOT KODI (ega qarori 11, maket `superadmin-products-edit-dialog-barcode`): zavod shtrix kodi (EAN-13/8,
 * UPC, GTIN-14) bo'lsa — o'sha; bo'lmasa Elchi kodi `ELC-P-…` (avtomatik, `sku_code`) QR stikerda chop etiladi.
 */

export type BarcodeIssue = "length" | "checksum";

/** GTIN nazorat raqami (EAN-13, UPC-A 12, GTIN-14): o'ngdan og'irlik 3, 1, 3 … */
const gtinCheckDigitValid = (digits: string) => {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
};

/**
 * Forma tekshiruvi (yengil): bo'sh — kodsiz; faqat raqamlar bo'lsa — 8, 12, 13 yoki 14 xona va (12–14 xonada)
 * nazorat raqami. 8 xonali kod EAN-8 ham, UPC-E ham bo'lishi mumkin — uni backend tekshiradi; harfli matn (zavod QR,
 * GS1 DataMatrix) — backendga qoladi.
 */
export const checkBarcodeInput = (raw: string): BarcodeIssue | null => {
  const value = raw.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  if (![8, 12, 13, 14].includes(value.length)) return "length";
  if (value.length === 8) return null;
  return gtinCheckDigitValid(value) ? null : "checksum";
};

/**
 * FormData ga shtrix kod — faqat o'zgargan bo'lsa (bo'sh satr — kodni olib tashlash; multipart'da `null` yo'q,
 * backend bo'sh satrni «kodsiz» deb oladi).
 */
export const appendProductBarcode = (formData: FormData, value: string, initial: string | null | undefined) => {
  const next = value.trim();
  if (next === (initial ?? "").trim()) return;
  formData.append("barcode", next);
};

/** 409 «Bu marketda shu shtrix kod … biriktirilgan» — nom dublikatidan (ham 409) xabar matni bilan ajratiladi. */
export const isDuplicateBarcodeError = (error: unknown) =>
  getErrorStatus(error) === 409 && /shtrix\s*kod|barcode/i.test(getBackendMessage(error) ?? "");

/**
 * QR modullari → SVG yo'li (`viewBox="0 0 n n"`, har qora modul — 1×1 kvadrat). Stiker standarti (taxta
 * `tizim-product-labels`): xato tuzatish Q, logosiz; `ELC-P-000123` — V1 (21 modul). Tinch zona yo'lga kirmaydi.
 */
export const qrPath = (value: string): { size: number; path: string } | null => {
  try {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "Q" });
    const parts: string[] = [];
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) parts.push(`M${col} ${row}h1v1h-1z`);
      }
    }
    return { size: modules.size, path: parts.join("") };
  } catch {
    return null;
  }
};
