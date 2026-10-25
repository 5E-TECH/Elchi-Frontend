/**
 * ZAVOD SHTRIX KODLARI (Trello CO66kcoB, ega qarori 2026-10-24): kamera «shtrix kod» rejimida o'qiydigan formatlar
 * va har o'qilgan kodning tekshiruvi. Dekoder (`BarcodeDetector` yoki ZXing) bergan qiymat shu yerdan o'tmasa —
 * kod QABUL QILINMAYDI (kadr «topilmadi» hisoblanadi, kamera keyingi kadrni o'qiydi).
 *
 *   - EAN-13 / EAN-8 / UPC-A — faqat raqam, aniq uzunlik va GTIN nazorat raqami (o'ngdan og'irlik 3, 1, 3 …);
 *   - Code128 — dekoderning o'zi mod 103 nazoratini tekshiradi, bu yerda — bo'sh emas;
 *   - QR — bo'sh emas (Elchi stikerlari `ELC-P-…` ham shu rejimda o'qiladi).
 */

/** Kamera rejimi: `qr` — faqat QR (sukut, hozirgi barcha oqimlar); `barcodes` — QR + zavod shtrix kodlari. */
export type ScanFormats = "qr" | "barcodes";

/** Formatlar — `BarcodeDetector` nomlari bilan (ZXing natijasi ham shu nomlarga o'tkaziladi). */
export type BarcodeFormatName = "qr_code" | "ean_13" | "ean_8" | "upc_a" | "code_128";

export const BARCODE_FORMATS: readonly BarcodeFormatName[] = ["qr_code", "ean_13", "ean_8", "upc_a", "code_128"];

const GTIN_LENGTH: Partial<Record<BarcodeFormatName, number>> = { ean_13: 13, ean_8: 8, upc_a: 12 };

/** GTIN nazorat raqami (GTIN-8 / 12 / 13 / 14): o'ngdan ikkinchi raqamdan boshlab og'irlik 3, 1, 3 … */
export const isValidGtin = (digits: string): boolean => {
  if (!/^(?:\d{8}|\d{12,14})$/.test(digits)) return false;
  let sum = 0;
  for (let index = digits.length - 2, weight = 3; index >= 0; index -= 1, weight = 4 - weight) {
    sum += Number(digits[index]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
};

/** O'qilgan kod qabul qilinadimi: format ro'yxatda, EAN/UPC — uzunlik va nazorat raqami to'g'ri. */
export const acceptDecodedCode = (format: string, raw: string): boolean => {
  if (!BARCODE_FORMATS.includes(format as BarcodeFormatName)) return false;
  const length = GTIN_LENGTH[format as BarcodeFormatName];
  if (length !== undefined) return raw.length === length && isValidGtin(raw);
  return raw.trim().length > 0;
};
