import { expect, type Page, type Route } from "@playwright/test";

/**
 * Investor kabineti (IN-1, IN-2) — soxta backend: INVESTOR («Habibulla Nazirov»), `GET investors/me/dashboard|
 * investments|profits` maket qiymatlari bilan (`investor-dashboard-home`, `investor-investments-list`,
 * `investor-profits-list`; oylar joriy oydan orqaga). Ro'yxatlar to'liq to'plamdan (5 investitsiya, 9 foyda davri)
 * `page` / `limit` / `from_date` / `to_date` / `is_paid` bo'yicha kesiladi — bosh sahifadagi `limit=3` / `limit=5`
 * javoblari avvalgidek. Holatlar: `empty`, `status` (dashboard va ro'yxatlar shu kod bilan yiqiladi — 403 / 404 /
 * 409 / 500). Yozish so'rovlari taqiqlangan. Serverga so'rov ketmaydi (jonli kanal WebSocket'i ham yopiladi).
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown, statusCode = 200) => ({ statusCode, message: "ok", data });

const monthKey = (back: number) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/** Maketdagi 12 oy (mln so'm): 2 oy bo'sh, 8 oy to'langan, oxirgidan oldingisi kutilmoqda, joriy oy — hali yopilmagan. */
const PAID = [0, 0, 2.4, 3.1, 3.6, 4.4, 5, 5.3, 4.9, 5.6, 0, 0];

const dashboard = (months: number, empty: boolean) => ({
  investor: { id: "7", name: "Habibulla Nazirov", phone_number: "+998901112233", status: "active" },
  summary: empty
    ? {
        total_invested: 0,
        investments_count: 0,
        last_invested_at: null,
        total_paid_profit: 0,
        total_unpaid_profit: 0,
        total_profit: 0,
        profit_shares_count: 0,
        current_percentage: null,
        last_paid_at: null,
      }
    : {
        total_invested: 450_000_000,
        investments_count: 5,
        last_invested_at: "2026-08-01T12:00:00+05:00",
        total_paid_profit: 34_300_000,
        total_unpaid_profit: 6_200_000,
        total_profit: 40_500_000,
        profit_shares_count: 9,
        current_percentage: 12.5,
        last_paid_at: "2026-09-05T10:00:00+05:00",
      },
  monthly: {
    months,
    items: Array.from({ length: months }, (_, index) => {
      const back = months - 1 - index;
      const slot = 11 - back;
      const paid = empty || slot < 0 ? 0 : PAID[slot] * 1_000_000;
      const unpaid = !empty && back === 1 ? 6_200_000 : 0;
      return { month: monthKey(back), paid_amount: paid, unpaid_amount: unpaid, total_amount: paid + unpaid };
    }),
  },
});

/** `page` / `limit` bo'yicha bitta sahifa (backend `normalizePagination`: sukut 10). */
const pageOf = <T>(rows: T[], query: URLSearchParams) => {
  const limit = Number(query.get("limit")) || 10;
  const page = Number(query.get("page")) || 1;
  return {
    items: rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
  };
};

/**
 * Sanalar kun o'rtasida (`T12:00:00+05:00`), yarim tunda emas: CI brauzeri UTC'da — yarim tun oldingi kunga chiqardi
 * (01.08 → 31.07). Unit testlardagi xuddi shu tuzatish — `43bab03`.
 */
const INVESTMENTS = [
  { id: "1", amount: 100_000_000, invested_at: "2026-08-01T12:00:00+05:00" },
  { id: "2", amount: 50_000_000, invested_at: "2026-06-20T12:00:00+05:00" },
  { id: "3", amount: 100_000_000, invested_at: "2026-04-12T12:00:00+05:00" },
  { id: "4", amount: 80_000_000, invested_at: "2026-03-03T12:00:00+05:00" },
  { id: "5", amount: 120_000_000, invested_at: "2026-01-15T12:00:00+05:00" },
];

const investments = (empty: boolean, query: URLSearchParams) => {
  const from = Date.parse(query.get("from_date") ?? "") || -Infinity;
  const to = Date.parse(query.get("to_date") ?? "") || Infinity;
  const rows = empty
    ? []
    : INVESTMENTS.filter((row) => Date.parse(row.invested_at) >= from && Date.parse(row.invested_at) <= to);
  return { ...pageOf(rows, query), summary: { total_amount: empty ? 0 : 450_000_000 } };
};

const profit = (id: string, month: number, last: number, amount: number, paidAt: string | null, percentage = 12.5) => {
  const mm = String(month).padStart(2, "0");
  return {
    id,
    amount,
    percentage,
    period_start: `2026-${mm}-01T12:00:00+05:00`,
    period_end: `2026-${mm}-${last}T23:59:59+05:00`,
    is_paid: paidAt != null,
    paid_at: paidAt ? `${paidAt}T10:00:00+05:00` : null,
  };
};

const PROFITS = [
  profit("20", 9, 30, 6_200_000, null),
  profit("19", 8, 31, 5_600_000, "2026-09-05"),
  profit("18", 7, 31, 4_900_000, "2026-08-05"),
  profit("17", 6, 30, 5_300_000, "2026-07-05"),
  profit("16", 5, 31, 5_000_000, "2026-06-05"),
  profit("15", 4, 30, 4_400_000, "2026-05-05"),
  profit("14", 3, 31, 3_600_000, "2026-04-05", 12),
  profit("13", 2, 28, 3_100_000, "2026-03-05", 12),
  profit("12", 1, 31, 2_400_000, "2026-02-05", 12),
];

const profits = (empty: boolean, query: URLSearchParams) => {
  const isPaid = query.get("is_paid");
  const rows = empty ? [] : PROFITS.filter((row) => isPaid == null || row.is_paid === (isPaid === "true"));
  return {
    ...pageOf(rows, query),
    summary: { total_paid_amount: empty ? 0 : 34_300_000, total_unpaid_amount: empty ? 0 : 6_200_000 },
  };
};

/** Backendning xom xato matni — sahifada HECH QACHON ko'rinmasligi kerak. */
export const RAW_BACKEND_MESSAGE = "investor profile is not available (e2e raw)";

export type InvestorHomeMock = {
  /** `investors/me/dashboard` ga ketgan `months` qiymatlari. */
  months: string[];
  /** Ro'yxat so'rovlarining query satri (`investors/me/investments?…`, `investors/me/profits?…`). */
  lists: string[];
  requested: string[];
  leaked: string[];
};

export type InvestorHomeOptions = {
  empty?: boolean;
  /** Investor `investors/me/*` so'rovlari shu kod bilan yiqiladi (faqat dashboard — `dashboardOnly`). */
  status?: 403 | 404 | 409 | 500;
  dashboardOnly?: boolean;
  theme?: "light" | "dark";
};

export const mockInvestorHome = async (page: Page, { empty = false, status, dashboardOnly = false, theme }: InvestorHomeOptions = {}) => {
  const mock: InvestorHomeMock = { months: [], lists: [], requested: [], leaked: [] };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    mock.requested.push(path);
    if (method !== "GET") {
      mock.leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({
          id: "42",
          role: "investor",
          name: "Habibulla Nazirov",
          status: "active",
          ...(theme ? { settings: { appearance: { theme, themeChosen: true } } } : {}),
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 3 }));
    if (path.startsWith("investors/me/")) {
      const isDashboard = path === "investors/me/dashboard";
      if (isDashboard) mock.months.push(url.searchParams.get("months") ?? "");
      if (status && (isDashboard || !dashboardOnly)) {
        return reply(route, { statusCode: status, message: RAW_BACKEND_MESSAGE, error: "Error" }, status);
      }
      if (isDashboard) return reply(route, wrap(dashboard(Number(url.searchParams.get("months") ?? 12), empty)));
      mock.lists.push(`${path}?${url.searchParams.toString()}`);
      if (path === "investors/me/investments") return reply(route, wrap(investments(empty, url.searchParams)));
      if (path === "investors/me/profits") return reply(route, wrap(profits(empty, url.searchParams)));
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return mock;
};

export const openInvestorHome = async (page: Page, options: InvestorHomeOptions = {}) => {
  const mock = await mockInvestorHome(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeVisible({ timeout: 90_000 });
  return mock;
};

/** IN-2: investor ro'yxat sahifasi (`/investments`, `/profits` + query) — h1 chiqquncha kutadi. */
export const openInvestorPage = async (page: Page, path: string, title: string, options: InvestorHomeOptions = {}) => {
  const mock = await mockInvestorHome(page, options);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 90_000 });
  return mock;
};

/** Sahifada gorizontal oqib ketish yo'q (hujjat ham, shell kontenti ham). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};

/** PR skrinshotlari: `E2E_SHOTS_DIR` berilsa — butun sahifa PNG (CI'da yozilmaydi). */
export const shot = async (page: Page, name: string) => {
  const dir = process.env.E2E_SHOTS_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
};
