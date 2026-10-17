import { formatNumberLocalized } from "../../../shared/lib/formatMoney";

/**
 * BUYURTMA SUMMASI MAYDONI (yaratish — «Umumiy summa», tahrirlash oynasi — «Umumiy summa») — D-17.
 *
 * `TextInput mode="money"` har qanday belgini jimgina olib tashlaydi: «12.5» → 125, «-5» → 5, 15 xonali son ham
 * qabul qilinardi (backend `numeric(14,2)` — 12 xonadan oshsa saqlanmaydi). Bu yerda maydonga YOZILGAN xom matn
 * tekshiriladi: kasr ajratkichi va minus — rad etiladi (qiymat o'zgarmaydi, maydon ostida sababi), 12 xonadan
 * uzun — rad etiladi. Mingliklar ajratkichi (uz/ru — bo'shliq, en — vergul) oddiy belgi sifatida o'tadi.
 */

/** Butun so'm, `numeric(14,2)` ning butun qismi — 12 xona. */
export const ORDER_AMOUNT_MAX_DIGITS = 12;

export type OrderAmountInputError = "fraction" | "negative" | "tooLong";

export const ORDER_AMOUNT_ERROR_KEYS: Record<OrderAmountInputError, string> = {
  fraction: "orders:amountInput.fraction",
  negative: "orders:amountInput.negative",
  tooLong: "orders:amountInput.tooLong",
};

export type OrderAmountInputResult = { digits: string; error: null } | { digits: null; error: OrderAmountInputError };

/** Tilning mingliklar ajratkichi — `formatNumberLocalized` bilan bir xil manbadan («1 000» / «1,000»). */
const groupSeparatorOf = (language?: string | null) => formatNumberLocalized(1000, { language }).replace(/\d/g, "");

/**
 * Maydondagi xom matn → saqlanadigan raqamlar satri yoki rad etish sababi.
 *
 *   readOrderAmountInput("150 000")  → { digits: "150000", error: null }
 *   readOrderAmountInput("12.5")     → { digits: null, error: "fraction" }
 */
export const readOrderAmountInput = (raw: string, language?: string | null): OrderAmountInputResult => {
  const text = raw ?? "";
  if (/[-−]/.test(text)) return { digits: null, error: "negative" };
  const group = groupSeparatorOf(language);
  const withoutGroups = group ? text.split(group).join("") : text;
  if (/[.,]/.test(withoutGroups)) return { digits: null, error: "fraction" };
  const digits = text.replace(/\D/g, "");
  if (digits.length > ORDER_AMOUNT_MAX_DIGITS) return { digits: null, error: "tooLong" };
  return { digits, error: null };
};
