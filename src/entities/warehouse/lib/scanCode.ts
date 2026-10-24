/**
 * SKANER KODI (ega qarori 11: har mahsulot turiga bitta kod — zavod shtrix kodi yoki Elchi QR stikeri `ELC-P-…`).
 *
 * Kirim va inventarizatsiya oynasidagi «Mahsulot» maydoniga USB skaner (klaviatura kabi) yoki qo'l bilan nima
 * yozilganini ajratadi: Elchi kodi, zavod shtrix kodi (EAN-8, UPC-A, EAN-13, GTIN-14 — faqat raqam) yoki erkin matn
 * (mahsulot nomi bo'yicha qidiruv). Kodni haqiqiy mahsulotga backend (`GET /warehouses/:id/lookup`) bog'laydi — bu
 * yerda faqat shakl.
 */

export type ScanCodeKind = "elchi" | "barcode" | "text";

const ELCHI_CODE = /^ELC-P-?\d{1,12}$/i;
const FACTORY_BARCODE = /^(?:\d{8}|\d{12,14})$/;

/** Skaner qiymati: chetdagi bo'shliq va skaner qo'shadigan boshqaruv belgilari olinadi. */
export const normalizeScanCode = (raw: string): string =>
  Array.from(raw)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();

export const classifyScanCode = (raw: string): ScanCodeKind => {
  const code = normalizeScanCode(raw);
  if (ELCHI_CODE.test(code)) return "elchi";
  if (FACTORY_BARCODE.test(code)) return "barcode";
  return "text";
};

/** Skaner (yoki qo'lda yozilgan) kod — nom qidiruvi emas: Elchi kodi yoki zavod shtrix kodi. */
export const isScanCode = (raw: string): boolean => classifyScanCode(raw) !== "text";

/** `ELC-P-000123` → `["ELC-P-", "000123"]` (stiker va jadvalda raqam alohida); boshqa kod — `null`. */
export const splitElchiCode = (code: string): [string, string] | null => {
  const match = /^(ELC-P-?)(\d+)$/i.exec(normalizeScanCode(code));
  return match ? [match[1].toUpperCase(), match[2]] : null;
};
