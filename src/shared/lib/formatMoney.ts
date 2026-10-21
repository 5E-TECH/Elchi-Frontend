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
 *  Manfiy son — haqiqiy minus belgisi `−` (U+2212), chiziqcha `-` emas: "−240 000 so'm"
 *  (maket `Main` → «Format standarti», DESIGN_SYSTEM §7). Kirim/chiqim ro'yxati uchun ishorali
 *  ko'rinish — `formatSignedMoneyLocalized` ("+185 000 so'm" / "−240 000 so'm").
 *  Foiz: uz/en "8,2%" / "8.2%", ru "8,2 %" (bo'linmas bo'sh joy bilan).
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

/** Tipografik minus (U+2212) — barcha manfiy son, pul va foiz shu belgi bilan. */
export const MINUS_SIGN = "\u2212";

/** Bo'linmas bo'sh joy (U+00A0) — ruscha foizda son va `%` orasida ("8,2 %"), qatorga bo'linmasin. */
const NO_BREAK_SPACE = "\u00a0";

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
 * `formatNumberLocalized(1545000)` → uz "1 545 000", en "1,545,000"; manfiy → "−1 545 000" (U+2212).
 * Yaxlitlanganda nolga teng bo'lsa (`-0,04` → "0") — minussiz.
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
  return num < 0 && !isZero ? `${MINUS_SIGN}${body}` : body;
};

/**
 * Pul summasi: butun so'mga yaxlitlanadi + valyuta.
 * `formatMoneyLocalized(185000)` → uz "185 000 so'm", ru "185 000 сум", en "185,000 UZS";
 * qarz `formatMoneyLocalized(-240000)` → "−240 000 so'm" (U+2212).
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
 * Ishorali pul — kirim/chiqim ro'yxati, balans harakati, «Balansga ta'siri»:
 * `formatSignedMoneyLocalized(185000)` → "+185 000 so'm", `(-240000)` → "−240 000 so'm",
 * `(0)` → "0 so'm" (nol ishorasiz; yaxlitlab nol bo'lsa ham). Ishora matnda turadi — rang yolg'iz
 * ma'no bermaydi; rangni chaqiruvchi beradi: musbat `text-success-fg`, manfiy `text-danger-fg`.
 */
export const formatSignedMoneyLocalized = (
  value: unknown,
  options: { language?: string | null; withCurrency?: boolean } = {},
): string => {
  const rounded = Math.round(toFiniteNumber(value));
  const text = formatMoneyLocalized(rounded, options);
  return rounded > 0 ? `+${text}` : text;
};

/**
 * Ixcham pul (KPI, grafik o'qlari): 1 dan 999 gacha to'liq, so'ng ming/mln/mlrd, 1 xona kasr.
 * `formatCompactMoneyLocalized(48_600_000)` → uz "48,6 mln so'm", ru "48,6 млн сум", en "48.6M UZS";
 * manfiy → "−13,5 mln so'm" (U+2212).
 */
export const formatCompactMoneyLocalized = (
  value: unknown,
  options: { language?: string | null; withCurrency?: boolean; fractionDigits?: number } = {},
): string => {
  const lang = resolveMoneyLanguage(options.language);
  const num = toFiniteNumber(value);
  const abs = Math.abs(num);
  const fractionDigits = options.fractionDigits ?? 1;
  // 999,6 → "1000 so'm" emas, "1 ming so'm": 1000 dan kichik summa butunga yaxlitlab tekshiriladi.
  const rankAbs = abs < COMPACT_STEPS[COMPACT_STEPS.length - 1][0] ? Math.round(abs) : abs;
  let index = COMPACT_STEPS.findIndex(([threshold]) => rankAbs >= threshold);
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

/**
 * Foiz: `fractionDigits` xonagacha (sukut 1), ortiqcha nollarsiz, locale ajratkichi bilan.
 * `formatPercentLocalized(8.2)` → uz "8,2%", ru "8,2 %" (bo'linmas bo'sh joy U+00A0, rus qoidasi —
 * maketdagidek), en "8.2%"; `formatPercentLocalized(50)` → "50%"; manfiy → "−6,2%" (U+2212).
 * Eski `designSystem.formatPercent` ("67.4%", har tilda nuqta) o'rniga.
 */
export const formatPercentLocalized = (
  value: unknown,
  options: { language?: string | null; fractionDigits?: number } = {},
): string => {
  const lang = resolveMoneyLanguage(options.language);
  const number = formatNumberLocalized(value, { language: lang, fractionDigits: options.fractionDigits ?? 1 });
  return lang === "ru" ? `${number}${NO_BREAK_SPACE}%` : `${number}%`;
};

/**
 * AQSH dollari (S4, OS-2 — AI xarajati va kunlik limit): doim 2 kasr xona (nollar saqlanadi), mingliklar ajratkichi
 * tildan. uz/ru — «12,40 $» / «1 234,50 $» (belgi oxirida, maket `superadmin-ops-system-ai-cap`), en — «$12.40»
 * (ingliz yozuvi; ega javob bermagan — sukut). Manfiy → «−12,40 $» / «−$12.40» (U+2212); yaxlitlab nol — minussiz.
 * Mavjud so'm formatlovchilari o'zgarmaydi — bu alohida funksiya.
 */
export const formatUsdLocalized = (value: unknown, options: { language?: string | null } = {}): string => {
  const lang = resolveMoneyLanguage(options.language);
  const { group, decimal } = SEPARATORS[lang];
  const num = toFiniteNumber(value);
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, fracPart] = fixed.split(".");
  const body = `${groupDigits(intPart, group)}${decimal}${fracPart}`;
  const sign = num < 0 && Number(fixed) !== 0 ? MINUS_SIGN : "";
  return lang === "en" ? `${sign}$${body}` : `${sign}${body} $`;
};
