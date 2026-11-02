import { test, type Page } from "@playwright/test";
import { HQ_MANAGER_PROFILE, setupShellSession } from "./shellSession";

/**
 * qzjTMWPb e2e yordamchisi: `GET finance/history/daily` va `GET finance/financial-balance/daily` (shartnoma —
 * FRONTEND_CHANGELOG 2026-10-26). Raqamlar deterministik; sanalar bugundan hisoblanadi.
 */
export const HISTORY_DAILY_PATH = "finance/history/daily";
export const BALANCE_DAILY_PATH = "finance/financial-balance/daily";

const pad = (value: number) => String(value).padStart(2, "0");
export const isoDay = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const INCOME = [7_920_000, 8_450_000, 6_830_000, 3_680_000, 3_140_000, 3_350_000, 920_000, 6_970_000];
const EXPENSE = [4_860_000, 5_210_000, 4_345_000, 2_700_000, 1_150_000, 1_625_000, 1_650_000, 2_400_000];

export const OPENING_BALANCE = 7_295_000;

/** `count` kun, oxirgisi bugun; qoldiq kirim/chiqimdan yig'iladi. */
export const historyDaily = (count = 14, overrides: Record<string, unknown> = {}) => {
  let balance = OPENING_BALANCE;
  const totals = { income: 0, expense: 0, net: 0, income_count: 0, expense_count: 0 };
  const days = Array.from({ length: count }, (_, index) => {
    const income = INCOME[index % INCOME.length];
    const expense = EXPENSE[index % EXPENSE.length];
    const opening = balance;
    balance += income - expense;
    totals.income += income;
    totals.expense += expense;
    totals.net += income - expense;
    totals.income_count += 3;
    totals.expense_count += 2;
    return {
      date: isoDay(index - count + 1),
      income,
      expense,
      net: income - expense,
      income_count: 3,
      expense_count: 2,
      opening_balance: opening,
      closing_balance: balance,
    };
  });
  return {
    timezone: "Asia/Tashkent",
    from: days[0].date,
    to: days[days.length - 1].date,
    scope: { cashbox_type: "main", cashbox_ids: null },
    filtered: false,
    balance_status: "ok",
    last_snapshot_date: isoDay(-1),
    opening_balance: OPENING_BALANCE,
    closing_balance: balance,
    totals,
    days,
    ...overrides,
  };
};

export const LIVE_BALANCE = {
  main: { balance: 24_600_000, cashbox: { balance: 24_600_000 } },
  markets: { allMarketCashboxes: [], marketsTotalBalans: -13_500_000 },
  couriers: { allCourierCashboxes: [], couriersTotalBalanse: 11_400_000 },
  chain: { chainReceivable: 8_400_000, providerReceivable: 3_000_000 },
  currentSituation: 22_500_000,
  difference: 0,
};

const snapshot = (index: number, overrides: Record<string, unknown> = {}) => ({
  source: "live",
  captured_at: `${isoDay(index - 13)}T19:05:00.000Z`,
  main_balance: 21_000_000 + index * 250_000,
  main_balance_cash: 15_000_000,
  main_balance_card: 6_000_000 + index * 250_000,
  chain_receivable: 10_000_000 + index * 100_000,
  provider_receivable: 0,
  in_transit: 10_000_000 + index * 100_000,
  market_cashbox_total: 12_000_000 + index * 100_000,
  market_payable_total: 12_000_000 + index * 100_000,
  markets_debt: -(12_000_000 + index * 100_000),
  courier_cashbox_total: 9_000_000,
  branch_cashbox_total: 1_000_000,
  current_situation: 19_000_000 + index * 250_000,
  ledger_balance: 7_500_000,
  ...overrides,
});

export const balanceDaily = (count = 14, overrides: Record<string, unknown> = {}) => {
  let closing = 7_507_000;
  const days = Array.from({ length: count }, (_, index) => {
    const income = (index + 1) * 90_000;
    const expense = index === count - 2 ? 1_900_000 : (index + 1) * 40_000;
    const opening = closing;
    closing += income - expense;
    const isToday = index === count - 1;
    return {
      date: isoDay(index - count + 1),
      snapshot: isToday ? null : snapshot(index),
      ledger: { opening_balance: opening, closing_balance: closing, income, expense, net: income - expense, count: 4 },
    };
  });
  const income = days.reduce((sum, day) => sum + day.ledger.income, 0);
  const expense = days.reduce((sum, day) => sum + day.ledger.expense, 0);
  return {
    timezone: "Asia/Tashkent",
    from: days[0].date,
    to: days[days.length - 1].date,
    last_snapshot_date: isoDay(-1),
    previous_day: { date: isoDay(-count), snapshot: null },
    ledger: {
      opening_balance: 7_507_000,
      closing_balance: closing,
      income,
      expense,
      net: income - expense,
      count: count * 4,
      peak: { date: isoDay(-2), balance: closing + 1_500_000 },
    },
    days,
    ...overrides,
  };
};

const CASHBOX_DATA = {
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
  "finance/cashbox/financial-balanse": LIVE_BALANCE,
};

type OpenOptions = {
  role?: string;
  route?: string;
  profile?: Record<string, unknown>;
  history?: unknown;
  balance?: unknown;
  extra?: Record<string, unknown>;
  theme?: "light" | "dark";
};

/** Sessiya + kunlik agregatlar. So'rov URL'lari `requests` da (filtr tekshiruvi uchun). */
export const openFinancePage = async (
  page: Page,
  { role = "superadmin", route = "/payments", profile = {}, history, balance, extra = {}, theme = "light" }: OpenOptions = {},
) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && /:3004|api\.elchipochta\.uz/.test(request.url())) requests.push(request.url());
  });
  const { leaked } = await setupShellSession(
    page,
    role,
    "Shodiyor Ergashev",
    {
      ...CASHBOX_DATA,
      [HISTORY_DAILY_PATH]: history ?? historyDaily(),
      [BALANCE_DAILY_PATH]: balance ?? balanceDaily(),
      ...extra,
    },
    { settings: { appearance: { theme, themeChosen: true, language: "uz" } }, ...profile },
  );
  await page.addInitScript((themeName) => {
    window.localStorage.setItem("theme", themeName);
    window.localStorage.setItem("theme-version", "2");
    window.localStorage.setItem("app-language", "uz");
  }, theme);
  await page.goto(route);
  return { leaked, requests };
};

export const openAsManager = (page: Page, route: string, options: OpenOptions = {}) =>
  openFinancePage(page, { role: "manager", route, profile: HQ_MANAGER_PROFILE, ...options });

/** Kunlik agregat berilgan holat bilan yiqiladi (`page.route` — `context.route` dan ustun). */
export const failDaily = (page: Page, path: string, status: number) =>
  page.route(`**/${path}*`, (route) => {
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
