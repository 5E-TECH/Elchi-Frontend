import { defineScene, fixture } from "../support/test";

/**
 * «Moliya» sahnalari: to'lovlar (superadmin), asosiy kassa (admin), market kassasi, moliyaviy balans.
 * Ma'lumot sintetik: `/payments` va asosiy kassa bitta asosiy kassa tarixini bo'lishadi
 * (`tests/visual/fixtures/finance/`), market kassasi — `cash-box/`, balans — `financial-balance/`; raqamlar maketdan
 * (kassa 24 615 000 so'm = naqd 18 240 000 + karta 6 375 000).
 */

/** Asosiy kassa: balans (naqd/karta), «smena ochiq», all-info (qabul qilinishi / berilishi kerak). */
const MAIN_CASHBOX = {
  "GET finance/cashbox/main": fixture("finance/cashbox-main.json"),
  "GET finance/cashbox/all-info": fixture("finance/all-info.json"),
  // GET finance/shift/current (kfdfYDik): asosiy kassaning ochiq smenasi — admin (persona 2) ochgan.
  "GET finance/shift/current": fixture("finance/shift-open.json"),
};

defineScene({
  id: "payments",
  // 1 faol filtr: «Kassa turi: Asosiy kassa».
  route: "/payments?cashbox_type=main",
  role: "superadmin",
  maket: ["superadmin-payments-overview"],
  api: {
    ...MAIN_CASHBOX,
    "GET finance/history": fixture("finance/history-payments.json"),
    // qzjTMWPb: «Pul oqimi» — 14 kun (FIXED_NOW bilan tugaydi).
    "GET finance/history/daily": fixture("finance/history-daily.json"),
    // «Yaratgan» filtri variantlari.
    "GET users": fixture("finance/staff-users.json"),
  },
});

defineScene({
  id: "main-cashbox",
  route: "/payments/main-cashbox",
  role: "admin",
  maket: ["admin-payments-main-cashbox"],
  api: {
    ...MAIN_CASHBOX,
    // Davrlar, manbalar va jadval — to'liq tarixdan (`limit=10000&cashbox_type=main`).
    "GET finance/history": fixture("finance/history-main.json"),
  },
});

defineScene({
  id: "cash-box",
  route: "/cash-box",
  role: "market",
  maket: ["market-cashbox-my"],
  api: {
    "GET finance/cashbox/my-cashbox": fixture("cash-box/my-cashbox.json"),
    "GET finance/history/daily": fixture("finance/history-daily.json"),
  },
});

defineScene({
  id: "financial-balance",
  route: "/financial-balance",
  role: "superadmin",
  maket: ["superadmin-balance-overview"],
  api: {
    "GET finance/cashbox/financial-balanse": fixture("financial-balance/balance.json"),
    // qzjTMWPb: KPI delta va 14 kunlik chiziq; 02–09.10 — `backfill` (yo'ldagi pul / umumiy balans nuqtalari yo'q).
    "GET finance/financial-balance/daily": fixture("financial-balance/daily.json"),
  },
});
