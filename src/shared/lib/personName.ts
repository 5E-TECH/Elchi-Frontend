/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SHAXS ISMI — har so'zning birinchi harfi katta (egasi: «ism so'ragan har joyda»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Faqat ODAM ismi: mijoz (qabul qiluvchi), xodimlar (superadmin, admin, menejer, registrator, logist,
 *  kuryer, investor, market operatori) va buyurtmadagi «Operator». Market/biznes nomi («Market nomi»),
 *  mahsulot, filial, viloyat nomlari, izoh va manzil — YOZILGANDEK qoladi.
 *
 *  Qoida:
 *    - chetdagi bo'sh joy qirqiladi, ketma-ket bo'shliqlar bittaga tushadi;
 *    - so'z bo'shliq yoki chiziqcha bilan ajraladi («abdulla-ugli» → «Abdulla-Ugli»);
 *    - so'zdagi birinchi HARF katta qilinadi (oldidagi tirnoq kabi harf bo'lmagan belgilar o'tkazib
 *      yuboriladi), qolgani yozilgandek: «o'tkir» → «O'tkir», «ALI» → «ALI», «mcDonald» → «McDonald»,
 *      «иван петров» → «Иван Петров».
 *
 *  Bitta harfga oddiy `toUpperCase` — tilga bog'liq emas (turkcha nuqtasiz «ı» kutilmagan natija bermaydi).
 *  Saqlangan eski yozuvlar ko'chirilmaydi: faqat yangi kiritilgan / tahrirlangan ism shu ko'rinishda yuboriladi.
 *  Maydonda — `TextInput personName` (fokusdan chiqqanda), yuborishda — payload quruvchisida shu funksiya.
 */

/** So'z ajratkichi: bo'shliq va chiziqcha (oddiy `-`, U+2010 «‐», U+2011 «‑»). */
const WORD_SEPARATOR = /[\s\-‐‑]/u;
const LETTER = /\p{L}/u;

/** Ismni shaxs ismi ko'rinishiga keltiradi. `null`/`undefined` — bo'sh satr. */
export const normalizePersonName = (value: string | null | undefined): string => {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  let result = "";
  let wordStart = true;
  for (const char of text) {
    if (WORD_SEPARATOR.test(char)) {
      wordStart = true;
      result += char;
    } else if (wordStart && LETTER.test(char)) {
      wordStart = false;
      result += char.toUpperCase();
    } else {
      result += char;
    }
  }
  return result;
};

/** Ismi biznes/hisob nomi bo'lgan rollar (market, filial hisobi) — ularning nomi o'zgartirilmaydi. */
const BUSINESS_NAME_ROLES: ReadonlySet<string> = new Set(["market", "marketing", "branch"]);

/** Shu rol egasining ismi shaxs ismimi (`normalizePersonName` qo'llanadimi). */
export const isPersonNameRole = (role: string | null | undefined): boolean => !BUSINESS_NAME_ROLES.has(role ?? "");
