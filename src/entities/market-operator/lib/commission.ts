import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import type { CommissionType, MarketOperator } from "../model/types";

/**
 * Komissiya chegaralari — backend (`updateMarketOperatorCommission`): foiz 0..100, qat'iy 0..1 000 000 so'm,
 * ko'pi bilan 2 kasr (`numeric(14,2)`).
 */
export const COMMISSION_MAX: Record<CommissionType, number> = { percent: 100, fixed: 1_000_000 };

/** «Namuna» bloki uchun buyurtma narxi (maket `market-operators-commission-dialog`). */
export const COMMISSION_SAMPLE_PRICE = 250_000;
/** Qat'iy summa izohidagi ikkinchi narx (maket `market-operators-commission-fixed-dialog`). */
export const COMMISSION_SAMPLE_PRICE_HIGH = 900_000;

/** Komissiya belgilanganmi: turi ham, qiymati ham bor (aks holda sotuvdan daromad yozilmaydi). */
export const hasCommission = (
  operator: Pick<MarketOperator, "commission_type" | "commission_value">,
): operator is { commission_type: CommissionType; commission_value: number } =>
  operator.commission_type !== null && operator.commission_value !== null;

/** Qat'iy summa: butun bo'lsa — `formatMoneyLocalized`, kasrli bo'lsa (2 xonagacha) yaxlitlanmaydi. */
const formatFixed = (value: number, language?: string | null) =>
  Number.isInteger(value)
    ? formatMoneyLocalized(value, { language })
    : `${formatNumberLocalized(value, { language, fractionDigits: 2 })} ${CURRENCY_LABEL[resolveMoneyLanguage(language)]}`;

/** Stavka qiymati: «5%», «3,5%» yoki «3 000 so'm». */
export const formatCommissionValue = (type: CommissionType, value: number, language?: string | null): string =>
  type === "percent" ? formatPercentLocalized(value, { language, fractionDigits: 2 }) : formatFixed(value, language);

/** Foiz bo'yicha namuna: `price` so'mlik sotuvdan yoziladigan daromad (butun so'm). */
export const percentEarning = (percent: number, price = COMMISSION_SAMPLE_PRICE) =>
  Math.round((price * percent) / 100);

export type CommissionInputError = "required" | "format" | "range";

export type CommissionInputResult =
  | { ok: true; value: number | null }
  | { ok: false; error: CommissionInputError };

const NUMBER_RE = /^\d+(?:\.\d{1,2})?$/;

/**
 * Maydon matni → son. Bo'sh joylar (mingliklar) olib tashlanadi, vergul — kasr ajratkichi. `optional` — bo'sh matn
 * «komissiyasiz» (`value: null`), aks holda `required`. Faqat manfiy bo'lmagan son, ko'pi bilan 2 kasr; chegara —
 * `COMMISSION_MAX[type]`.
 */
export const parseCommissionInput = (
  type: CommissionType,
  raw: string,
  { optional = false }: { optional?: boolean } = {},
): CommissionInputResult => {
  const text = raw.replace(/\s/g, "").replace(",", ".");
  if (!text) return optional ? { ok: true, value: null } : { ok: false, error: "required" };
  if (!NUMBER_RE.test(text)) return { ok: false, error: "format" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: "format" };
  if (value > COMMISSION_MAX[type]) return { ok: false, error: "range" };
  return { ok: true, value };
};

/** Butun qism mingliklari oddiy bo'sh joy bilan (`parseCommissionInput` bo'sh joyni olib tashlaydi). */
const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Maydonga boshlang'ich matn (mavjud stavka): «3,5» / «3 000» — kiritish bilan bir xil ko'rinishda. */
export const commissionInputText = (value: number | null, language?: string | null): string => {
  if (value === null) return "";
  const [integer, fraction] = String(value).split(".");
  const decimal = resolveMoneyLanguage(language) === "en" ? "." : ",";
  return fraction ? `${groupThousands(integer)}${decimal}${fraction}` : groupThousands(integer);
};
