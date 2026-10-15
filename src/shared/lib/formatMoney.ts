import i18n from "../../i18n";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  PUL VA SON FORMATLASH — dizayn v2 (yagona manba)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  uz  → "185 000 so'm",  ixcham "48,6 mln so'm" / "1,5 ming so'm" / "2,3 mlrd so'm"
 *  ru  → "185 000 сум",   ixcham "48,6 млн сум"  / "1,5 тыс. сум"  / "2,3 млрд сум"
 *  en  → "185,000 UZS",   ixcham "48.6M UZS"     / "1.5K UZS"      / "2.3B UZS"
 *
 *  ⚠️ `Intl.NumberFormat` ATAYLAB ishlatilmaydi: Chrome'ning qisqartirilgan
 *  ICU ma'lumotida "uz" yo'q va u inglizchaga qaytib "1,545,000" beradi,
 *  Node (vitest) esa to'liq ICU bilan "1 545 000" — test yashil, brauzer
 *  xato (financialBalance.ts:362 izohi). Ajratkichlar shu yerda qo'lda.
 *
 *  Yangi kod pul/sonni FAQAT shu fayl orqali formatlaydi (docs/DESIGN_SYSTEM.md).
 */

export type MoneyLanguage = "uz" | "ru" | "en";

/** Valyuta nomi — uchala tilda bitta qoida (locale JSON'dagi `currency` kalitlari ham shunday). */
export const CURRENCY_LABEL: Record<MoneyLanguage, string> = { uz: "so'm", ru: "сум", en: "UZS" };

const SEPARATORS: Record<MoneyLanguage, { group: string; decimal: string }> = {
  uz: { group: " ", decimal: "," },
  ru: { group: " ", decimal: "," },
  en: { group: ",", decimal: "." },
};

/** Ixcham qisqartmalar: [chegara, uz, ru, en]. `en` qo'shimchasi raqamga yopishib yoziladi. */
const COMPACT_STEPS: ReadonlyArray<[number, Record<MoneyLanguage, string>]> = [
  [1_000_000_000, { uz: "mlrd", ru: "млрд", en: "B" }],
  [1_000_000, { uz: "mln", ru: "млн", en: "M" }],
  [1_000, { uz: "ming", ru: "тыс.", en: "K" }],
];

/** i18n tilidan `uz | ru | en` ni aniqlaydi (noma'lum → uz). */
export const resolveMoneyLanguage = (language?: string | null): MoneyLanguage => {
  const lang = (language ?? i18n.resolvedLanguage ?? i18n.language ?? "uz").toLowerCase().split("-")[0];
  return lang === "ru" || lang === "en" ? lang : "uz";
};

const toFiniteNumber = (value: unknown): number => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const groupDigits = (digits: string, group: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, group);

/**
 * Son: mingliklar ajratkichi bilan, `fractionDigits` xonagacha (ortiqcha nollar olib tashlanadi).
 * `formatNumberLocalized(1545000)` → uz "1 545 000", en "1,545,000".
 */
export const formatNumberLocalized = (
  value: unknown,
  options: { language?: string | null; fractionDigits?: number } = {},
): string => {
  const lang = resolveMoneyLanguage(options.language);
  const { group, decimal } = SEPARATORS[lang];
  const fractionDigits = options.fractionDigits ?? 0;
  const num = toFiniteNumber(value);
  const fixed = Math.abs(num).toFixed(fractionDigits);
  const [intPart, fracPart] = fixed.split(".");
  const trimmedFrac = fracPart?.replace(/0+$/, "");
  const body = groupDigits(intPart, group) + (trimmedFrac ? decimal + trimmedFrac : "");
  const isZero = Number(fixed) === 0;
  return num < 0 && !isZero ? `-${body}` : body;
};

/**
 * Pul summasi: butun so'mga yaxlitlanadi + valyuta.
 * `formatMoneyLocalized(185000)` → uz "185 000 so'm", ru "185 000 сум", en "185,000 UZS".
 * `withCurrency: false` — faqat raqam (jadval ustunida valyuta sarlavhada bo'lsa).
 */
export const formatMoneyLocalized = (
  value: unknown,
  options: { language?: string | null; withCurrency?: boolean } = {},
): string => {
  const lang = resolveMoneyLanguage(options.language);
  const amount = formatNumberLocalized(Math.round(toFiniteNumber(value)), { language: lang });
  return options.withCurrency === false ? amount : `${amount} ${CURRENCY_LABEL[lang]}`;
};

/**
 * Ixcham pul (KPI, grafik o'qlari): 1 dan 999 gacha to'liq, so'ng ming/mln/mlrd, 1 xona kasr.
 * `formatCompactMoneyLocalized(48_600_000)` → uz "48,6 mln so'm", ru "48,6 млн сум", en "48.6M UZS".
 */
export const formatCompactMoneyLocalized = (
  value: unknown,
  options: { language?: string | null; withCurrency?: boolean; fractionDigits?: number } = {},
): string => {
  const lang = resolveMoneyLanguage(options.language);
  const num = toFiniteNumber(value);
  const abs = Math.abs(num);
  const fractionDigits = options.fractionDigits ?? 1;
  let index = COMPACT_STEPS.findIndex(([threshold]) => abs >= threshold);
  // 999 950 → "1000 ming" emas, "1 mln": yaxlitlangach 1000 ga yetsa keyingi pog'onaga o'tadi.
  if (index > 0 && Number((abs / COMPACT_STEPS[index][0]).toFixed(fractionDigits)) >= 1000) index -= 1;
  const step = index >= 0 ? COMPACT_STEPS[index] : undefined;
  let text: string;
  if (!step) {
    text = formatNumberLocalized(Math.round(num), { language: lang });
  } else {
    const [threshold, labels] = step;
    const scaled = formatNumberLocalized(num / threshold, { language: lang, fractionDigits });
    text = lang === "en" ? `${scaled}${labels.en}` : `${scaled} ${labels[lang]}`;
  }
  return options.withCurrency === false ? text : `${text} ${CURRENCY_LABEL[lang]}`;
};
