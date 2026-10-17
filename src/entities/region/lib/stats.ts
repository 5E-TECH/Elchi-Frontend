import { CURRENCY_LABEL, formatCompactMoneyLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";

/**
 * Hudud statistikasi uchun kichik hisob-kitoblar (`/regions`, `RegionDetailDialog`, dashboard).
 * Backend `stats/all` qatorida `pendingOrders` va `successRate` YO'Q, `stats/:id` esa foizni butun songa
 * yaxlitlaydi — shuning uchun foiz va «jarayonda» shu yerda aniq hisoblanadi.
 */

const finite = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Ulush foizda (0..100): `part / total`; `total ≤ 0` → 0. */
export const shareOf = (part: number, total: number): number => (total > 0 ? (finite(part) / total) * 100 : 0);

/** Muvaffaqiyat: sotilgan / qabul qilingan (0..100, aniq). Buyurtma bo'lmasa — 0. */
export const successRateOf = (delivered: number, total: number): number =>
  Math.min(100, Math.max(0, shareOf(delivered, total)));

/** Jarayonda: backend bergan son, bo'lmasa `jami − sotilgan − bekor` (manfiy bo'lmaydi). */
export const pendingOf = (total: number, delivered: number, cancelled: number, pending?: number): number => {
  const given = finite(pending);
  if (given > 0) return given;
  return Math.max(0, finite(total) - finite(delivered) - finite(cancelled));
};

/**
 * Ixcham pul StatCard uchun ikki bo'lakka: `48 600 000` → `{ value: "48,6", unit: "mln so'm" }`
 * (maket `.el-kpi-value` + `.el-kpi-unit`); en — `{ value: "48.6M", unit: "UZS" }`.
 */
export const splitCompactMoney = (amount: number, language?: string | null): { value: string; unit: string } => {
  const lang = resolveMoneyLanguage(language);
  const currency = CURRENCY_LABEL[lang];
  const compact = formatCompactMoneyLocalized(amount, { language: lang, withCurrency: false });
  if (lang === "en") return { value: compact, unit: currency };
  const space = compact.lastIndexOf(" ");
  const suffix = space > 0 ? compact.slice(space + 1) : "";
  if (suffix && /^[^\d−]/.test(suffix)) {
    return { value: compact.slice(0, space), unit: `${suffix} ${currency}` };
  }
  return { value: compact, unit: currency };
};

/**
 * Viloyat nomining qisqa ko'rinishi (xarita yorlig'i, reyting): «Toshkent shahri» → «Toshkent sh.»,
 * «Toshkent viloyati» → «Toshkent vil.», «Samarqand viloyati» → «Samarqand»,
 * «Qoraqalpog'iston Respublikasi» → «Qoraqalpog'iston». Boshqa matn o'zgarmaydi.
 */
export const shortRegionName = (name: string): string => {
  const trimmed = name.replace(/\s+/g, " ").trim();
  const lower = trimmed.toLocaleLowerCase();
  if (/^toshkent sh(ahri|ahar|\.)?$/.test(lower)) return "Toshkent sh.";
  if (/^toshkent (viloyati|vil\.?)$/.test(lower)) return "Toshkent vil.";
  return trimmed.replace(/\s+(viloyati|respublikasi)$/i, "") || trimmed;
};
