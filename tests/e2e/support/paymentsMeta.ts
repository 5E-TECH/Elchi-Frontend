import { test, type Page } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * uzWcMR1C e2e yordamchisi: `/payments` KPI kartalari — soxta all-info va `GET finance/cashbox/payments-meta`.
 * Raqamlar maketdan (`superadmin-payments-overview`).
 */
export const PAYMENTS_META_PATH = "finance/cashbox/payments-meta";

export const paymentsMeta = (overrides: Record<string, unknown> = {}) => ({
  receivable: {
    amount: 9_870_000,
    branches: { count: 5, amount: 8_770_000 },
    hq_couriers: { count: 2, amount: 1_100_000 },
  },
  payable: {
    markets_count: 6,
    amount: 13_458_000,
    top_markets: [
      { market_id: "101", cashbox_id: "55", name: "Baraka Shop", amount: 4_820_000, share: 35.8 },
      { market_id: "102", cashbox_id: "56", name: "Nur Elektronika", amount: 3_146_000, share: 23.4 },
      { market_id: "103", cashbox_id: "57", name: "Chilonzor Market", amount: 2_260_000, share: 16.8 },
    ],
    others: { count: 3, amount: 3_232_000, share: 24 },
  },
  ...overrides,
});

const PAGE_DATA = {
  "finance/cashbox/all-info": {
    kassadagi_summa: 24_615_000,
    olinishi_kerak: 9_870_000,
    berilishi_kerak: 13_458_000,
    branch_managers_receivable: 8_770_000,
    hq_couriers_receivable: 1_100_000,
    mainCashboxTotal: 24_615_000,
    courierCashboxTotal: 9_870_000,
    marketCashboxTotal: 13_458_000,
  },
  "finance/cashbox/main": { cashbox: { id: "1", balance: 24_615_000, balance_cash: 18_240_000, balance_card: 6_375_000 } },
  "finance/shift/current": { shift: { id: "31", status: "open", opened_by: "2" }, required: true },
};

export const openPayments = async (
  page: Page,
  { role = "superadmin", meta = paymentsMeta() as unknown, profile = {} as Record<string, unknown> } = {},
) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && /:3004|api\.elchipochta\.uz/.test(request.url())) requests.push(request.url());
  });
  const { leaked } = await setupShellSession(page, role, "Shodiyor Ergashev", { ...PAGE_DATA, [PAYMENTS_META_PATH]: meta }, profile);
  await page.goto("/payments");
  return { leaked, requests };
};

/** payments-meta so'rovi berilgan holat bilan yiqiladi (qolgan API `setupShellSession` da). */
export const failPaymentsMeta = (page: Page, status: number) =>
  page.route(`**/${PAYMENTS_META_PATH}*`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    return route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ statusCode: status, message: "e2e" }),
    });
  });
