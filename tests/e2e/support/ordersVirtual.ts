import { expect, type Page, type Route } from "@playwright/test";

/**
 * F4RSPBwx — /orders 100 qator (virtualizatsiya): soxta API (superadmin), 100 ta buyurtma `limit=100` da.
 */
/** Ilova manzili (`E2E_ORIGIN` — boshqa portda yurgizish uchun, sukut `playwright.config.ts` dagi 4173). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const createdAt = new Date().toISOString();
export const ORDER_COUNT = 100;
/** №1 … №100 — ro'yxatda kamayish tartibida (birinchi qator №100 emas, №1). */
export const orderRef = (n: number) => `EL-${String(100_000 + n)}`;
const ORDERS = Array.from({ length: ORDER_COUNT }, (_, i) => ({
  id: 9000 + i + 1,
  order_number: orderRef(i + 1),
  status: "waiting",
  where_deliver: i % 2 ? "center" : "address",
  total_price: 150000 + i * 1000,
  createdAt,
  customer: { id: `c${i}`, name: `Mijoz ${i + 1}`, phone_number: "+998901112233" },
  market: { id: "m1", name: "Baraka Shop" },
  district: { id: "d1", name: "Chilonzor" },
}));

export const mockHundredOrders = async (page: Page) => {
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    if (path === "orders") {
      const limit = Number(url.searchParams.get("limit") ?? 25);
      const items = ORDERS.slice(0, limit);
      return reply(route, { statusCode: 200, data: items, total: ORDERS.length, page: 1, limit });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
};

/** Hujjatdagi barcha DOM tugunlari. */
export const domNodeCount = (page: Page) => page.evaluate(() => document.getElementsByTagName("*").length);

/** Shell skroll konteyneri (`<main>`) oxirigacha — virtualizatsiya pastki qatorlarni chizadi. */
export const scrollShellToBottom = async (page: Page) => {
  for (let i = 0; i < 6; i += 1) {
    await page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollTo({ top: main.scrollHeight }));
    await page.waitForTimeout(150);
  }
};

export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollWidth - main.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
