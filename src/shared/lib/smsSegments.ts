/**
 * SMS kodlash va bo'laklar hisobi (D5sxjGBY, nkhURiKX #4).
 *
 * ⚠️ Backendda AYNI qoida bor (Elchi-Backend
 * apps/notification-service/src/sms/sms-segments.util.ts) — ikkalasi bir xil
 * test vektorlari bilan sinaladi, aks holda muharrirdagi narx bilan hisobdagi
 * narx farq qiladi. Birini o'zgartirsangiz ikkinchisini ham.
 *
 * - GSM-7: 160 / ko'p bo'lakda 153 septet; kengaytma belgilari
 *   (^ { } [ ] ~ | \ € va form feed) 2 septet.
 * - UCS-2: GSM-7 ga sig'maydigan BITTA belgi (kirill, ё, o‘ dagi ‘, emoji)
 *   butun xabarni UCS-2 ga o'tkazadi: 70 / 67 (UTF-16 birlik, emoji = 2).
 * - Belgi ikki bo'lakka bo'linmaydi.
 */

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsSegments {
  encoding: SmsEncoding;
  units: number;
  parts: number;
  perPart: number;
}

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENSION = "\f^{}\\[~]|€";

const BASIC = new Set(Array.from(GSM7_BASIC));
const EXTENSION = new Set(Array.from(GSM7_EXTENSION));

const LIMITS = {
  "GSM-7": { single: 160, multi: 153 },
  "UCS-2": { single: 70, multi: 67 },
} as const;

export const isGsm7 = (text: string): boolean =>
  Array.from(text).every((ch) => BASIC.has(ch) || EXTENSION.has(ch));

const widths = (text: string, encoding: SmsEncoding): number[] =>
  Array.from(text).map((ch) => (encoding === "GSM-7" ? (EXTENSION.has(ch) ? 2 : 1) : ch.length));

const pack = (items: number[], capacity: number): number => {
  let parts = 1;
  let used = 0;
  for (const width of items) {
    if (used + width > capacity) {
      parts += 1;
      used = 0;
    }
    used += width;
  }
  return parts;
};

export function countSmsSegments(text: string): SmsSegments {
  const encoding: SmsEncoding = isGsm7(text) ? "GSM-7" : "UCS-2";
  const items = widths(text, encoding);
  const units = items.reduce((sum, width) => sum + width, 0);
  const limit = LIMITS[encoding];
  if (units === 0) return { encoding, units, parts: 0, perPart: limit.single };
  if (units <= limit.single) return { encoding, units, parts: 1, perPart: limit.single };
  return { encoding, units, parts: pack(items, limit.multi), perPart: limit.multi };
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Matndagi `{{var}}` lar (takrorsiz). */
export const templateVars = (text: string): string[] => [...new Set(Array.from(text.matchAll(VAR_RE), (m) => m[1]))];

/** `{{var}}` larni to'ldiradi; to'ldirilmaganlari joyida qoladi (ko'rinsin). */
export const fillTemplate = (text: string, vars: Record<string, string>): string =>
  text.replace(VAR_RE, (whole, key: string) => (vars[key]?.trim() ? vars[key].trim() : whole));

/** Reklama matniga qo'shiladigan bekor qilish ko'rsatmasi — backend bilan bir xil shakl, bo'lak hisobiga KIRADI. */
export const OPT_OUT_SAMPLE = "\nRad etish: https://api.elchipochta.uz/sms/stop/998900000000.XXXXXXXXXXXXXXXX";
