import { expect, type Page, type Route } from "@playwright/test";

/**
 * MO-2 — market operatori qobig'i, bosh sahifasi (`/`, `MarketDashboardPage` operator rejimida) va «Daromadim»
 * (`/my-earnings`) uchun soxta backend. `analytics/dashboard` — operatorning marketi bo'yicha (backend
 * `resolveRequesterForMarket`); `auth/my-profile` — `market_id` va komissiya; `orders/extra-cost-approvals` — o'z
 * marketining kutilayotgan so'rovi (6QLF7nst: operatorga faqat o'qish). Yozish so'rovlari taqiqlangan (`leaked`),
 * jonli kanal yopiladi.
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

export const OPERATOR_ID = "42";
export const OPERATOR_MARKET_ID = "7";

const market = (id: string, name: string, total: number, sold: number) => ({
  market_id: id,
  market_name: name,
  total_orders: total,
  successful_orders: sold,
  success_rate: (sold / total) * 100,
});

/** 6QLF7nst — kutilayotgan qo'shimcha xarajat so'rovi (backend 0Ngp09FG shakli: `order_number`, `requested_by`). */
const PENDING_APPROVALS = [
  {
    id: "501",
    order_id: "76",
    order_number: "EL-100076",
    market_id: OPERATOR_MARKET_ID,
    requested_by_user_id: "301",
    requested_by_role: "courier",
    requested_by: { id: "301", name: "Ali Kuryer" },
    action: "sell",
    amount: 25_000,
    status: "pending",
    proof_file_keys: [],
    createdAt: new Date().toISOString(),
  },
];

const DASHBOARD = {
  myStat: { totalOrders: 38, soldOrders: 24, canceledOrders: 4, profit: 3_450_000, successRate: 63.16, inProgress: 10 },
  markets: [market(OPERATOR_MARKET_ID, "Baraka Shop", 38, 24)],
  topMarkets: [market("3", "Nur Elektronika", 40, 33), market(OPERATOR_MARKET_ID, "Baraka Shop", 38, 24)],
  topMarketsMeta: { period_rule: "last_30_days", period_days: 30, min_orders: 1 },
  topOperators: [],
};

type Commission = { type: "percent" | "fixed"; value: number | string } | null;

type MockOptions = {
  /** Profildagi komissiya; `null` — belgilanmagan. Sukut: 5%. */
  commission?: Commission;
  theme?: "light" | "dark";
};

export type MarketOperatorMock = {
  /** Barcha GET so'rovlarining yo'llari (sizish tekshiruvi uchun). */
  requested: string[];
  leaked: string[];
};

export const mockMarketOperator = async (page: Page, { commission = { type: "percent", value: "5.00" }, theme }: MockOptions = {}) => {
  const mock: MarketOperatorMock = { requested: [], leaked: [] };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    if (method === "GET") mock.requested.push(path);
    if (path === "auth/my-profile" && method === "GET") {
      return reply(
        route,
        wrap({
          id: OPERATOR_ID,
          role: "market_operator",
          name: "Dilnoza Karimova",
          phone_number: "+998901234567",
          status: "active",
          market_id: OPERATOR_MARKET_ID,
          commission_type: commission?.type ?? null,
          commission_value: commission?.value ?? null,
          ...(theme ? { settings: { appearance: { theme, themeChosen: true } } } : {}),
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 2 }));
    if (path === "analytics/dashboard" && method === "GET") return reply(route, wrap(DASHBOARD));
    if (path === "orders/extra-cost-approvals" && method === "GET") {
      return reply(route, wrap(url.searchParams.get("status") === "pending" ? PENDING_APPROVALS : []));
    }
    if (method !== "GET") {
      mock.leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
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

export const openOperatorHome = async (page: Page, options: MockOptions = {}) => {
  const mock = await mockMarketOperator(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("market-stats-grid")).toContainText("38", { timeout: 30_000 });
  return mock;
};

export const openOperatorEarnings = async (page: Page, options: MockOptions = {}) => {
  const mock = await mockMarketOperator(page, options);
  await page.goto("/my-earnings");
  await expect(page.getByRole("heading", { level: 1, name: "Daromadim" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Market egasi", { exact: true })).toBeVisible({ timeout: 30_000 });
  return mock;
};

/**
 * Sizish to'sig'i — ruxsat ro'yxati (allowlist): operator bosh sahifasi va «Daromadim» faqat o'z profili, o'z marketi
 * analitikasi (`analytics/dashboard`), o'z marketining xarajat so'rovlari (6QLF7nst — faqat o'qish) va qobiq
 * hisoblagichini so'raydi. Boshqa har qanday GET (kompaniya analitikasi, `region/stats`, moliya, kassa, investor,
 * buyurtmalar, foydalanuvchilar, market egasining operatorlar ro'yxati va h.k.) — sizish; catch-all mock unga 200
 * bersa ham test yiqiladi.
 */
const ALLOWED_GET = new Set([
  "auth/my-profile",
  "analytics/dashboard",
  "orders/extra-cost-approvals",
  "notifications/inbox/unread-count",
]);
/** Ruxsat ro'yxatidagi yo'l ham bosh sahifa bo'lmasa so'ralmasligi kerak (`/my-earnings` faqat profilni o'qiydi). */
const HOME_ONLY_GET = new Set(["analytics/dashboard", "orders/extra-cost-approvals"]);

export const expectNoLeakRequests = (mock: MarketOperatorMock, { home = true }: { home?: boolean } = {}) => {
  // Yozuvchi ishlayotganini tasdiqlash (aks holda tekshiruv bo'sh ro'yxat ustida «o'tib» ketadi).
  expect(mock.requested).toContain("auth/my-profile");
  if (home) {
    expect(mock.requested).toContain("analytics/dashboard");
    expect(mock.requested).toContain("orders/extra-cost-approvals");
  }
  expect(mock.requested.filter((path) => !ALLOWED_GET.has(path))).toEqual([]);
  if (!home) expect(mock.requested.filter((path) => HOME_ONLY_GET.has(path))).toEqual([]);
  expect(mock.leaked).toEqual([]);
};

/** Sahifada gorizontal oqib ketish yo'q (hujjat ham, shell kontenti ham). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};

/**
 * MO-3: shell kontentidagi buyurtma havolalari faqat operatorga ochiq yo'llarga — ro'yxat (`/orders…`) va yaratish
 * (`/new-orders/create`); «Qabul va yaratish» qobig'ining boshqa yo'llari (`/new-orders`, `/new-orders/:id` …) — 403.
 */
export const expectOnlyOperatorOrderLinks = async (page: Page) => {
  const hrefs = await page
    .locator("[data-shell-slot=content] a[href]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const orderLinks = hrefs.filter((href) => /^\/(orders|new-orders)/.test(href));
  expect(orderLinks).toContain("/new-orders/create");
  // `/orders/edit/:id` — buyurtma tafsiloti (MO-3: operatorga ochiq; xarajat so'rovidagi raqam havolasi).
  expect(
    orderLinks.filter(
      (href) => !/^\/orders(\?|$)/.test(href) && !/^\/orders\/edit\/\d+$/.test(href) && href !== "/new-orders/create",
    ),
  ).toEqual([]);
};
