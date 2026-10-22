import { expect, type Page, type Route } from "@playwright/test";

/**
 * LG-1 — logist bosh sahifasi (`/`, rol `logist`) uchun soxta backend: `region/stats/all` 5 viloyat qaytaradi
 * (3 tasi shu logistga — `logist_id = 42`, biri boshqa logistga, biri biriktirilmagan; har birida `revenue` bor —
 * sahifa uni ko'rsatmasligi kerak). Yozish so'rovlari taqiqlangan (`leaked`), jonli kanal yopiladi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown, statusCode = 200) => ({ statusCode, message: "ok", data });

export const LOGIST_ID = "42";

const region = (
  id: number,
  name: string,
  logistId: string | null,
  [total, delivered, cancelled]: [number, number, number],
  [active, couriers]: [number, number],
  districts: number,
) => ({
  id,
  name,
  sato_code: String(1700 + id),
  logist_id: logistId,
  districts_count: districts,
  totalOrders: total,
  deliveredOrders: delivered,
  cancelledOrders: cancelled,
  revenue: 987_654_321,
  activeCouriers: active,
  totalCouriers: couriers,
});

const REGIONS = [
  region(6, "Samarqand viloyati", LOGIST_ID, [86, 58, 9], [18, 22], 16),
  region(8, "Qashqadaryo viloyati", LOGIST_ID, [12, 9, 1], [9, 11], 14),
  region(10, "Surxondaryo viloyati", LOGIST_ID, [9, 7, 1], [7, 8], 14),
  region(1, "Toshkent shahri", "7", [500, 400, 20], [40, 50], 12),
  region(3, "Andijon viloyati", null, [30, 20, 5], [5, 6], 14),
];

type MockOptions = {
  /** Logistga hech viloyat biriktirilmagan. */
  unassigned?: boolean;
  /** `region/stats/all` 500 qaytaradi (`mock.failing = false` gacha; so'rov kutubxonasi qayta urinishi ham). */
  fail?: boolean;
  theme?: "light" | "dark";
};

export type LogistHomeMock = {
  /** `region/stats/all` so'rovlarining query satrlari. */
  statsQueries: string[];
  /** Barcha GET so'rovlarining yo'llari (LG-S1: moliya so'rovlari ketmasligini tekshirish uchun). */
  requested: string[];
  leaked: string[];
  /** `true` — `region/stats/all` 500 qaytaradi. */
  failing: boolean;
};

export const mockLogistHome = async (page: Page, { unassigned = false, fail = false, theme }: MockOptions = {}) => {
  const mock: LogistHomeMock = { statsQueries: [], requested: [], leaked: [], failing: fail };
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
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({
          id: LOGIST_ID,
          role: "logist",
          name: "Aziz Rahimov",
          status: "active",
          ...(theme ? { settings: { appearance: { theme, themeChosen: true } } } : {}),
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 3 }));
    if (path === "region/stats/all" && method === "GET") {
      mock.statsQueries.push(url.search);
      if (mock.failing) {
        return reply(route, { statusCode: 500, message: "Internal RPC timeout logistics.region.stats_all" }, 500);
      }
      const regions = unassigned ? REGIONS.filter((item) => item.logist_id !== LOGIST_ID) : REGIONS;
      return reply(route, wrap({ regions, summary: { totalRegions: regions.length } }));
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

export const openLogistHome = async (page: Page, options: MockOptions = {}) => {
  const mock = await mockLogistHome(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeVisible({ timeout: 90_000 });
  if (!options.unassigned && !options.fail) {
    await expect(page.getByText("Sizga biriktirilgan 3 ta viloyat: Samarqand, Qashqadaryo, Surxondaryo")).toBeVisible({
      timeout: 30_000,
    });
  }
  return mock;
};

/** LG-S1: logist moliyani ko'rmaydi — moliya/analitika so'rovlari umuman yuborilmaydi. */
const FINANCE_REQUEST = /analytics|cashbox|cash-box|payments|financial|investors/;

export const expectNoFinanceRequests = (mock: LogistHomeMock) => {
  // Yozuvchi ishlayotganini tasdiqlash (aks holda tekshiruv bo'sh ro'yxat ustida «o'tib» ketadi).
  expect(mock.requested).toContain("region/stats/all");
  expect(mock.requested.filter((path) => FINANCE_REQUEST.test(path))).toEqual([]);
};

/** Sahifada gorizontal oqib ketish yo'q (hujjat ham, shell kontenti ham). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};
