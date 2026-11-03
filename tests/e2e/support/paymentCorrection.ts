import { HISTORY_DAILY_PATH, historyDaily } from "./financeDaily";

/**
 * T6-FE-1 (XXyAZ9ge) e2e soxta ma'lumotlari: kassa tarixida to'lov tuzatish (`correction`, `payment_reversal`),
 * backend shartnomasi bo'yicha (dev c93afc4, `payment-correction.rules.ts` `attachCorrectionViews`). Faqat o'qish —
 * `setupShellSession` yetadi (yozish so'rovi 403 + `leaked`). Raqamlar maketlardan (`*-corrected`).
 *
 * Yo'llar `setupShellSession` handler kalitlari (bosh `/` siz); tafsilot — `finance/history/:id`.
 */

/**
 * Bugungi, lekin O'TGAN vaqt: hozirdan `minutesAgo` daqiqa oldin. Yarim tundan keyin darhol ishga tushsa — kun
 * boshiga qisiladi (sana «Bugun» bo'lib qoladi), tartib saqlanadi (kamroq = yangiroq).
 */
const today = (minutesAgo: number) => {
  const now = Date.now();
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return new Date(Math.max(now - minutesAgo * 60_000, midnight + (600 - minutesAgo) * 1000)).toISOString();
};

const SUPERADMIN = { id: "1", name: "Shodiyor Ergashev", role: "superadmin" };
const REVERSE_REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";
const EDIT_REASON = "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan";

/* ── Kuryer kassasi (`/cash-box`, maket `courier-cashbox-my-transfers-corrected`) ─────────────────────────── */

const COURIER_PAID_AT = today(130);
const COURIER_REVERSED_AT = today(40);

const courierOriginal = (cashboxType: string) => ({
  id: "4512",
  amount: 1_850_000,
  operation_type: "expense",
  source_type: "courier_payment",
  payment_method: "cash",
  cashbox_id: "70",
  cashbox_type: cashboxType,
  comment: "Kunlik topshiriq",
  balance_after: 0,
  payment_ack: null,
  createdByUser: SUPERADMIN,
  payment_date: COURIER_PAID_AT,
  createdAt: COURIER_PAID_AT,
  transfer_id: "b6f1c0de-0000-4000-8000-000000004512",
  reverses_history_id: null,
  correction: {
    id: "12",
    action: "reverse",
    payment_kind: "courier_payment",
    role: "original",
    reason: REVERSE_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: COURIER_REVERSED_AT,
    original_amount: 1_850_000,
    new_amount: null,
    related_history_id: "4530",
    related: {
      id: "4530",
      source_type: "payment_reversal",
      role: "reversal",
      operation_type: "income",
      amount: 1_850_000,
      created_at: COURIER_REVERSED_AT,
    },
  },
});

const courierReversal = (cashboxType: string) => ({
  id: "4530",
  amount: 1_850_000,
  operation_type: "income",
  source_type: "payment_reversal",
  source_id: "4512",
  payment_method: "cash",
  cashbox_id: "70",
  cashbox_type: cashboxType,
  // Backend teskari yozuvga sababni izoh sifatida yozadi (PCS:643).
  comment: REVERSE_REASON,
  balance_after: 1_850_000,
  createdByUser: SUPERADMIN,
  payment_date: null,
  createdAt: COURIER_REVERSED_AT,
  transfer_id: "b6f1c0de-0000-4000-8000-000000004530",
  reverses_history_id: "4512",
  correction: {
    id: "12",
    action: "reverse",
    payment_kind: "courier_payment",
    role: "reversal",
    reason: REVERSE_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: COURIER_REVERSED_AT,
    original_amount: 1_850_000,
    new_amount: null,
    related_history_id: "4512",
    related: {
      id: "4512",
      source_type: "courier_payment",
      role: "original",
      operation_type: "expense",
      amount: 1_850_000,
      created_at: COURIER_PAID_AT,
    },
  },
});

const courierPlain = (cashboxType: string) => ({
  id: "4490",
  amount: 2_400_000,
  operation_type: "expense",
  source_type: "courier_payment",
  payment_method: "cash",
  cashbox_id: "70",
  cashbox_type: cashboxType,
  comment: "Kunlik tushum topshirildi",
  balance_after: 640_000,
  payment_ack: null,
  createdByUser: { id: 7, name: "Mohira Qodirova", role: "manager" },
  createdAt: today(200),
  transfer_id: "b6f1c0de-0000-4000-8000-000000004490",
  reverses_history_id: null,
  correction: null,
});

/** `GET finance/cashbox/my-cashbox` — kuryer: teskari yozuv, qaytarilgan to'lov va oddiy o'tkazma. */
export const courierCashboxWithCorrection = (cashboxType = "couriers") => ({
  cashbox: { id: "70", cashbox_type: cashboxType, balance: 1_850_000 },
  cashboxHistory: [courierReversal(cashboxType), courierOriginal(cashboxType), courierPlain(cashboxType)],
});

/** Kuryer kassasi yozuvlarining tafsilotlari (`GET finance/history/:id`, kuryerga `correctable` yo'q). */
export const courierCorrectionDetails = (cashboxType = "couriers") => {
  const cashbox = { id: "70", balance: 1_850_000, cashbox_type: cashboxType };
  return {
    "finance/history/4512": { ...courierOriginal(cashboxType), cashbox },
    "finance/history/4530": { ...courierReversal(cashboxType), cashbox },
  };
};

/**
 * `GET finance/cashbox/user/263` — menejer ko'radigan kuryer kassasi tafsiloti (`/payments/cash-detail/263?type=courier`,
 * maket yo'q — eng yaqini `superadmin-payments-cash-detail-courier-corrected`).
 */
export const courierCashDetailWithCorrection = () => ({
  cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 1_850_000 },
  history: courierCashboxWithCorrection().cashboxHistory,
  user: { id: "263", name: "Jasur Tursunov", phone_number: "+998904121855", role: "courier", status: "active" },
  is_hq_courier: true,
  can_receive: true,
  receive_check_failed: false,
  olinishi_kerak: 1_850_000,
  counterparty: "HQ",
});

/* ── Market kassasi (`/cash-box`, maket `market-cashbox-my-corrected`) ─────────────────────────────────────── */

const MARKET_PAID_AT = today(180);
const MARKET_EDITED_AT = today(60);
const marketCashbox = { id: "55", balance: 5_035_000, cashbox_type: "markets" };

const marketOriginal = () => ({
  id: "4498",
  amount: 2_400_000,
  operation_type: "expense",
  source_type: "market_payment",
  payment_method: "click",
  cashbox_id: "55",
  cashbox_type: "markets",
  comment: "Oktabr, 1-hafta hisobi",
  balance_after: 4_635_000,
  createdByUser: SUPERADMIN,
  payment_date: MARKET_PAID_AT,
  createdAt: MARKET_PAID_AT,
  transfer_id: "c7a2d1ef-0000-4000-8000-000000004498",
  reverses_history_id: null,
  correction: {
    id: "13",
    action: "edit",
    payment_kind: "market_payment",
    role: "original",
    reason: EDIT_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: MARKET_EDITED_AT,
    original_amount: 2_400_000,
    new_amount: 2_000_000,
    related_history_id: "4521",
    related: {
      id: "4522",
      source_type: "market_payment",
      role: "replacement",
      operation_type: "expense",
      amount: 2_000_000,
      created_at: MARKET_EDITED_AT,
    },
  },
});

const marketReversal = () => ({
  id: "4521",
  amount: 2_400_000,
  operation_type: "income",
  source_type: "payment_reversal",
  source_id: "4498",
  payment_method: "click",
  cashbox_id: "55",
  cashbox_type: "markets",
  comment: EDIT_REASON,
  balance_after: 7_035_000,
  createdByUser: SUPERADMIN,
  payment_date: null,
  createdAt: MARKET_EDITED_AT,
  transfer_id: "c7a2d1ef-0000-4000-8000-000000004521",
  reverses_history_id: "4498",
  correction: {
    id: "13",
    action: "edit",
    payment_kind: "market_payment",
    role: "reversal",
    reason: EDIT_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: MARKET_EDITED_AT,
    original_amount: 2_400_000,
    new_amount: 2_000_000,
    related_history_id: "4498",
    related: {
      id: "4498",
      source_type: "market_payment",
      role: "original",
      operation_type: "expense",
      amount: 2_400_000,
      created_at: MARKET_PAID_AT,
    },
  },
});

/**
 * Yangi to'lov: backend asl `payment_date` ni nusxalaydi (PCS:671,701) — ro'yxatda tuzatish vaqti (`createdAt`)
 * ko'rinishi va tepada turishi kerak (C1); teskari yozuv bilan vaqt teng — tartib ID dan (`compareHistoryIdDesc`).
 */
const marketReplacement = () => ({
  id: "4522",
  amount: 2_000_000,
  operation_type: "expense",
  source_type: "market_payment",
  payment_method: "click",
  cashbox_id: "55",
  cashbox_type: "markets",
  comment: "Oktabr, 1-hafta hisobi",
  balance_after: 5_035_000,
  createdByUser: SUPERADMIN,
  payment_date: MARKET_PAID_AT,
  // Teskari yozuv bilan bir tranzaksiyada — vaqt bir xil; tepada turishi ID tartibidan (4522 > 4521).
  createdAt: MARKET_EDITED_AT,
  transfer_id: "c7a2d1ef-0000-4000-8000-000000004522",
  reverses_history_id: null,
  correction: {
    id: "13",
    action: "edit",
    payment_kind: "market_payment",
    role: "replacement",
    reason: EDIT_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: MARKET_EDITED_AT,
    original_amount: 2_400_000,
    new_amount: 2_000_000,
    related_history_id: "4498",
    related: {
      id: "4498",
      source_type: "market_payment",
      role: "original",
      operation_type: "expense",
      amount: 2_400_000,
      created_at: MARKET_PAID_AT,
    },
  },
});

const marketSell = () => ({
  id: "4400",
  amount: 640_000,
  operation_type: "income",
  source_type: "sell",
  source_id: "10239",
  payment_method: "cash",
  cashbox_id: "55",
  cashbox_type: "markets",
  balance_after: 7_035_000,
  createdAt: today(300),
  correction: null,
});

/** `GET finance/cashbox/my-cashbox` — market: asl (tahrirlangan) to'lov, teskari yozuv, yangi to'lov va sotuv. */
export const marketCashboxWithEdit = () => ({
  cashbox: marketCashbox,
  // Tartib ataylab «noto'g'ri» (asl `payment_date` bo'yicha) — sahifa `historyRowDate` bo'yicha saralaydi.
  cashboxHistory: [marketReversal(), marketOriginal(), marketReplacement(), marketSell()],
});

export const marketCorrectionDetails = () => ({
  "finance/history/4498": { ...marketOriginal(), cashbox: marketCashbox },
  "finance/history/4521": { ...marketReversal(), cashbox: marketCashbox },
  "finance/history/4522": { ...marketReplacement(), cashbox: marketCashbox },
});

/* ── Superadmin «Operatsiyalar tarixi» (`/payments`, maket `superadmin-payments-overview-corrected`) ───────── */

const mainLeg = (row: Record<string, unknown>) => ({
  ...row,
  cashbox_id: "1",
  cashbox_type: "main",
  balance_after: undefined,
  cashbox: { id: "1", balance: 24_615_000, cashbox_type: "main" },
});

const mainCourierOriginal = () =>
  mainLeg({
    ...courierOriginal("main"),
    id: "4511",
    operation_type: "income",
    payment_ack: undefined,
    source_user: { id: "263", name: "Jasur Tursunov", role: "courier" },
    correction: {
      ...courierOriginal("main").correction,
      related_history_id: "4531",
      related: { ...courierOriginal("main").correction.related, id: "4531", operation_type: "expense" },
    },
  });

const mainCourierReversal = () =>
  mainLeg({
    ...courierReversal("main"),
    id: "4531",
    operation_type: "expense",
    source_id: "4511",
    source_user: { id: "263", name: "Jasur Tursunov", role: "courier" },
    reverses_history_id: "4511",
    correction: {
      ...courierReversal("main").correction,
      related_history_id: "4511",
      related: { ...courierReversal("main").correction.related, id: "4511", operation_type: "income" },
    },
  });

const marketParty = { id: "101", name: "Baraka Shop", role: "market" };

/** `GET finance/history` — asosiy kassa: ikkala tuzatish (qaytarish va tahrir) to'rt turdagi belgi bilan. */
export const historyOverviewWithCorrections = () => {
  const items = [
    mainCourierReversal(),
    mainLeg({ ...marketReplacement(), source_user: marketParty }),
    mainLeg({ ...marketReversal(), source_user: marketParty }),
    mainCourierOriginal(),
    mainLeg({ ...marketOriginal(), source_user: marketParty }),
  ];
  return { items, meta: { page: 1, limit: 10, total: items.length, totalPages: 1 } };
};

export const overviewCorrectionDetails = () => {
  const { items } = historyOverviewWithCorrections();
  return Object.fromEntries(items.map((item) => [`finance/history/${item.id}`, item]));
};

/** `/payments` sahifasining qolgan so'rovlari (KPI va grafik — xato holati chiqmasin). */
export const OVERVIEW_PAGE_DATA = {
  "finance/cashbox/all-info": {
    kassadagi_summa: 24_615_000,
    olinishi_kerak: 9_870_000,
    berilishi_kerak: 13_458_000,
    mainCashboxTotal: 24_615_000,
  },
  "finance/cashbox/main": { cashbox: { id: "1", balance: 24_615_000, balance_cash: 18_240_000, balance_card: 6_375_000 } },
  "finance/shift/current": { shift: { id: "31", status: "open", opened_by: "2" }, required: true },
  [HISTORY_DAILY_PATH]: historyDaily(),
};
