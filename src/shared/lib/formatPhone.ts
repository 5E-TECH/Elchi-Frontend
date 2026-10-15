import { UZBEKISTAN_PHONE_PREFIX } from "./phone";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TELEFON RAQAMINI KO'RSATISH — dizayn v2 (DESIGN_SYSTEM §7)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  O'zbekiston raqami hamma tilda bir xil: "+998 90 123 45 67" (2-3-2-2 guruh).
 *  Qo'ng'iroq havolasi: "tel:+998901234567".
 *
 *  Bu KO'RSATISH uchun (jadval, karta, tafsilot). Maydon niqobi (yozish paytida
 *  qisman guruhlash, kursor) — `phone.ts` (`formatUzbekistanPhoneLocal`,
 *  `keepPhoneCaretAfterChange`); u qisqa yoki uzun kiritmani kesib tashlaydi,
 *  bu fayl esa noto'g'ri raqamni «tuzatmaydi» — o'zini qaytaradi, xato ko'rinib tursin.
 *
 *  Qabul qilinadigan O'zbekiston shakllari (bo'sh joy, chiziqcha, qavs, nuqta bilan ham):
 *    "901234567"          — 9 ta raqam (mahalliy qism, `+` siz)
 *    "998901234567"       — 12 ta raqam, `998` bilan (`+` bilan yoki `+` siz)
 *    "+998 (90) 123-45-67", "+998-90-123-45-67"
 *    "00998901234567"     — xalqaro `00` prefiksi
 *  Boshqa hamma narsa (xorijiy raqam, chala raqam, harfli matn) — qirqilgan holda o'zgarishsiz.
 *  Bo'sh qiymat — "—".
 */

/** Bo'sh qiymat belgisi (`formatDate.ts` bilan bir xil). */
const EMPTY = "—";
const COUNTRY_CODE = UZBEKISTAN_PHONE_PREFIX.slice(1); // "998"
const LOCAL_LENGTH = 9;
/** E.164 bo'yicha xalqaro raqam 15 xonadan oshmaydi. */
const MAX_INTERNATIONAL_LENGTH = 15;

/**
 * Faqat raqam va ajratkichlardan iborat matn: boshida ixtiyoriy `+` va `(`, so'ng raqam bilan
 * boshlanib raqam, bo'sh joy, qavs, nuqta, chiziqcha (oddiy `-` va tipografik U+2010…U+2015)
 * bilan davom etadi. Harf bo'lsa yoki `-` bilan boshlansa — telefon emas.
 */
const PHONE_LIKE = /^\+?\(?\d[\d\s().\-‐-―]*$/;

/** Kiritmani matnga keltiradi: satr qirqiladi, chekli son satrga aylanadi, qolgani — bo'sh. */
const toText = (raw: unknown): string => {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
};

/**
 * O'zbekiston raqamining 9 xonali mahalliy qismi ("901234567") yoki `null`.
 * `null` — raqam O'zbekistonniki emas yoki to'liq emas (xorijiy, chala, harfli).
 */
export const parseUzbekPhone = (raw: unknown): string | null => {
  const text = toText(raw);
  if (!text || !PHONE_LIKE.test(text)) return null;
  const hasPlus = text.startsWith("+");
  const digits = text.replace(/\D/g, "");

  if (!hasPlus && digits.length === LOCAL_LENGTH) return digits;
  if (digits.length === COUNTRY_CODE.length + LOCAL_LENGTH && digits.startsWith(COUNTRY_CODE)) {
    return digits.slice(COUNTRY_CODE.length);
  }
  if (!hasPlus && digits.length === 2 + COUNTRY_CODE.length + LOCAL_LENGTH && digits.startsWith(`00${COUNTRY_CODE}`)) {
    return digits.slice(2 + COUNTRY_CODE.length);
  }
  return null;
};

/**
 * Telefon raqamini ko'rsatish uchun formatlaydi.
 * `formatPhone("901234567")` → "+998 90 123 45 67";
 * `formatPhone("+7 916 123-45-67")` → "+7 916 123-45-67" (xorijiy — o'zgarishsiz);
 * `formatPhone(null)` → "—".
 */
export const formatPhone = (raw: unknown): string => {
  const text = toText(raw);
  if (!text) return EMPTY;
  const local = parseUzbekPhone(text);
  if (!local) return text;
  return `${UZBEKISTAN_PHONE_PREFIX} ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
};

/**
 * `<a href>` uchun qo'ng'iroq havolasi: `toTelHref("90 123 45 67")` → "tel:+998901234567".
 * Xorijiy raqam ham ajratkichlarsiz havolaga aylanadi ("tel:+79161234567").
 * Telefonga o'xshamasa (bo'sh, harfli, 3 xonadan qisqa yoki 15 dan uzun) yoki "+998" bilan
 * boshlanib xonalari 12 ta bo'lmasa ("+998 90 123 45 6") — `undefined`:
 * `<a href={undefined}>` havola bo'lmaydi, oddiy matn qoladi.
 */
export const toTelHref = (raw: unknown): string | undefined => {
  const text = toText(raw);
  if (!text || !PHONE_LIKE.test(text)) return undefined;
  const local = parseUzbekPhone(text);
  if (local) return `tel:${UZBEKISTAN_PHONE_PREFIX}${local}`;
  const digits = text.replace(/\D/g, "");
  // "+998" bilan boshlanib uzunligi noto'g'ri — chala/ortiqcha O'zbekiston raqami: havola noto'g'ri
  // raqamga qo'ng'iroq qilardi, matn bo'lib qolsin (xato ko'rinib tursin).
  if (text.startsWith("+") && digits.startsWith(COUNTRY_CODE)) return undefined;
  if (digits.length < 3 || digits.length > MAX_INTERNATIONAL_LENGTH) return undefined;
  return `tel:${text.startsWith("+") ? "+" : ""}${digits}`;
};
