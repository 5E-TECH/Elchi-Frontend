import { OVERVIEW_PAGE_DATA } from "./paymentCorrection";

/**
 * O'tkazma izi (ega 2026-11-26; BE #800) e2e soxta ma'lumotlari: kuryer pulni to'g'ridan-to'g'ri marketga o'tkazgan —
 * asosiy kassada bir to'lov (`transfer_id`) ichida «Kirim +300 000» (`courier_payment`) va «Chiqim −300 000»
 * (`market_payment`), ikkalasi `pass_through: true`. Yonida oddiy sotuv (+420 000). Qoldiq zanjiri: sotuvdan keyin
 * 24 615 000 → +300 000 → −300 000 → 24 615 000.
 */

const now = Date.now();
/** Bugungi, o'tgan vaqt (yarim tundan keyin darhol — kun boshiga qisiladi, tartib saqlanadi). */
const minutesAgo = (minutes: number) => {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return new Date(Math.max(now - minutes * 60_000, midnight + (600 - minutes) * 1000)).toISOString();
};

const MAIN = { id: "1", balance: 24_615_000, cashbox_type: "main" };
const HQ = { id: "2", name: "Shodiyor Ergashev", role: "superadmin" };
const COURIER = { id: "263", name: "Jasur Tursunov", phone_number: "+998904121855", role: "courier" };
const MARKET = { id: "101", name: "Baraka Shop", phone_number: "+998903001122", role: "market" };

const leg = (row: Record<string, unknown>) => ({
  cashbox_id: "1",
  cashbox_type: "main",
  cashbox: MAIN,
  correction: null,
  transfer_id: null,
  created_by_user: HQ,
  ...row,
});

export const passThroughHistory = () => [
  leg({
    id: "4513",
    amount: 300_000,
    operation_type: "expense",
    source_type: "market_payment",
    payment_method: "click_to_market",
    balance_after: 24_615_000,
    transfer_id: "tr-77",
    pass_through: true,
    pass_through_pair_id: "4512",
    source_user: MARKET,
    payment_date: minutesAgo(20),
    createdAt: minutesAgo(20),
  }),
  leg({
    id: "4512",
    amount: 300_000,
    operation_type: "income",
    source_type: "courier_payment",
    payment_method: "click_to_market",
    balance_after: 24_915_000,
    transfer_id: "tr-77",
    pass_through: true,
    pass_through_pair_id: "4513",
    source_user: COURIER,
    payment_date: minutesAgo(20),
    createdAt: minutesAgo(20),
  }),
  leg({
    id: "4490",
    amount: 420_000,
    operation_type: "income",
    source_type: "sell",
    source_id: "10237",
    payment_method: "cash",
    balance_after: 24_615_000,
    payment_date: minutesAgo(60),
    createdAt: minutesAgo(60),
  }),
];

/**
 * `GET finance/history` (ekran, `collapse_pass_through`) — juftdan faqat kirim oyog'i, chiqim oyog'i unga
 * `pass_through_partner` bo'lib biriktirilgan (sahifalash va `total` juftni bitta qator sanaydi).
 */
export const collapsedHistory = () => {
  const [expense, income, sale] = passThroughHistory();
  return [{ ...income, pass_through_partner: expense }, sale];
};

/** `/payments` va `/payments/main-cashbox` (superadmin) uchun javoblar. */
export const passThroughPageData = () => {
  const items = collapsedHistory();
  return {
    ...OVERVIEW_PAGE_DATA,
    "finance/history": {
      items,
      counts: { all: 2, income: 1, expense: 0 },
      pagination: { total: items.length, page: 1, limit: 10, totalPages: 1 },
      meta: { page: 1, limit: 10, total: items.length, totalPages: 1 },
    },
    // Asosiy kassa javobi — ikkala oyoq (grafik qoldiq zanjiri).
    "finance/cashbox/main": {
      cashbox: { id: "1", balance: 24_615_000, balance_cash: 18_240_000, balance_card: 6_375_000 },
      cashboxHistory: passThroughHistory(),
    },
  };
};
