import { expect, type Page, type Route } from "@playwright/test";
import { aiDistrictsByRegion, aiPreview, aiProducts, aiRegions } from "../../../src/test/aiOrderFixtures";

/**
 * MO-3 — market operatori buyurtmalari (`/orders`, `/orders/edit/:id`) va «AI bilan» yaratish (`/new-orders/create`)
 * uchun soxta backend. Operatorga backendda yopiq yo'llar (`markets*`, boshqa marketning `orders/markets/*`,
 * `orders/:id/tracking`, kuryerlar, foydalanuvchilar) so'ralsa — `forbidden` ga yoziladi va 403 qaytadi (haqiqiy
 * backend kabi); test oxirida ro'yxat bo'sh bo'lishi shart. O'z marketining `orders/markets/7/new` (nCAFnqIe / N12) va
 * `orders/extra-cost-approvals` (6QLF7nst, faqat o'qish) — ochiq.
 */
// Worktree serverlari boshqa portda — `E2E_ORIGIN`.
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const OPERATOR_MARKET_ID = "7";

const order = (id: string, name: string, status: string, total: number, district: string, extra: Record<string, unknown> = {}) => ({
  id,
  status,
  market_id: OPERATOR_MARKET_ID,
  where_deliver: "address",
  total_price: total,
  to_be_paid: status === "paid" ? 0 : total,
  paid_amount: status === "paid" ? total : 0,
  market_tariff: 25000,
  comment: null,
  address: "Chilonzor 9-kvartal, 14-uy",
  createdAt: "2026-10-21T09:26:00.000Z",
  customer: { id: `c-${id}`, name, phone_number: "+998902145508" },
  district: { id: "101", name: district, region: { id: "11", name: "Toshkent sh." } },
  region: { id: "11", name: "Toshkent sh." },
  market: { id: OPERATOR_MARKET_ID, name: "Baraka Shop" },
  items: [{ id: `i-${id}`, quantity: 1, product_id: "501", product: { id: "501", name: "Telefon ushlagich" } }],
  ...extra,
});

export const OPERATOR_ORDERS = [
  order("10247", "Sevara Tojiboyeva", "new", 185000, "Yunusobod tumani"),
  order("10239", "Mansur Karimov", "sold", 640000, "Shayxontohur tumani"),
  order("10235", "Malika Yusupova", "cancelled", 96000, "Sergeli tumani"),
];

/**
 * Operatorga backendda yopiq (403) yo'llar — frontend ularni umuman so'ramasligi kerak. `region`, `district` —
 * MO-7 dan ochiq (backend 6cb2340, N11); o'z marketining `orders/markets/7/new` — N12 (backend a3c67d0);
 * `orders/extra-cost-approvals` (GET) — N14 (8f0811b).
 */
const FORBIDDEN_GET = new RegExp(
  `^(markets?($|/)|orders/markets/(?!${OPERATOR_MARKET_ID}/new$)|orders/[^/]+/tracking$|users($|/)|couriers|branches|market-operators)`,
);

export type MarketOperatorOrdersMock = {
  /** Barcha so'rovlar (`GET orders`, `POST orders/ai-parse` …). */
  requests: string[];
  /** `GET orders` query parametrlari. */
  listQueries: URLSearchParams[];
  /** `POST orders/ai-confirm` tanalari. */
  confirmBodies: Record<string, unknown>[];
  /** `POST orders` (qo'lda, MO-7) tanalari va `Idempotency-Key` sarlavhalari. */
  orderBodies: Record<string, unknown>[];
  orderKeys: Array<string | undefined>;
  /** Operatorga yopiq yo'llar so'ralgan bo'lsa — shu yerda. */
  forbidden: string[];
  /** Kutilmagan yozuvchi so'rovlar. */
  leaked: string[];
};

type Options = {
  /** `orders/ai-availability` (sukut — yoqiq). */
  aiEnabled?: boolean;
  /** `orders/ai-parse` buyurtmalari (sukut — 2 ta: biri tayyor, biri tumansiz taklif bilan). */
  parsed?: unknown[];
  theme?: "light" | "dark";
};

export const PARSED_DEFAULT = [
  // AI tumanni aniqladi, viloyat esa yo'q — operatorda viloyat shart emas (ai-confirm uni tumandan oladi).
  aiPreview({ customer_name: "Sevara Tojiboyeva", region_id: null, region_name: null, region_given: false }),
  aiPreview({
    customer_name: "Mansur Karimov",
    phone_number: "+998936271840",
    total_price: 640000,
    region_id: null,
    region_name: null,
    district_id: null,
    district_name: null,
    district_candidates: [{ id: "102", label: "Yunusobod", region_name: "Toshkent shahri" }],
  }),
];

export const mockMarketOperatorOrders = async (page: Page, { aiEnabled = true, parsed = PARSED_DEFAULT, theme }: Options = {}) => {
  const mock: MarketOperatorOrdersMock = { requests: [], listQueries: [], confirmBodies: [], orderBodies: [], orderKeys: [], forbidden: [], leaked: [] };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    mock.requests.push(`${method} ${path}`);

    if (path === "auth/my-profile" && method === "GET") {
      return reply(
        route,
        wrap({
          id: "42",
          role: "market_operator",
          name: "Dilnoza Karimova",
          phone_number: "+998901234567",
          status: "active",
          market_id: OPERATOR_MARKET_ID,
          // N13: operator marketi (sarlavhada «Baraka Shop nomidan»).
          market: { id: OPERATOR_MARKET_ID, name: "Baraka Shop", add_order: true },
          commission_type: "percent",
          commission_value: "5.00",
          ...(theme ? { settings: { appearance: { theme, themeChosen: true } } } : {}),
        }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (method === "GET" && FORBIDDEN_GET.test(path)) {
      mock.forbidden.push(path);
      return reply(route, { statusCode: 403, message: "Forbidden resource", error: "Forbidden" }, 403);
    }
    if (path === "orders" && method === "GET") {
      mock.listQueries.push(url.searchParams);
      const statuses = url.searchParams.getAll("status").flatMap((value) => value.split(","));
      const items = statuses.length ? OPERATOR_ORDERS.filter((item) => statuses.includes(item.status)) : OPERATOR_ORDERS;
      return reply(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 10 });
    }
    // N12: o'z marketining yangi buyurtmalari — bugungi «Yangi» (market roli bilan bir xil javob, massiv).
    if (path === `orders/markets/${OPERATOR_MARKET_ID}/new` && method === "GET") {
      return reply(
        route,
        wrap(OPERATOR_ORDERS.filter((item) => item.status === "new").map((item) => ({ ...item, createdAt: new Date().toISOString() }))),
      );
    }
    const detail = OPERATOR_ORDERS.find((item) => path === `orders/${item.id}`);
    if (detail && method === "GET") return reply(route, wrap(detail));
    if (path === "orders/ai-availability") {
      return reply(route, wrap(aiEnabled ? { enabled: true, state: "enabled" } : { enabled: false, state: "disabled" }));
    }
    if (path.startsWith("product/my-products")) return reply(route, wrap(aiProducts));
    if (path === "region" && method === "GET") return reply(route, wrap(aiRegions));
    const regionDistricts = /^region\/(\d+)$/.exec(path);
    if (regionDistricts && method === "GET") {
      return reply(route, { districts: aiDistrictsByRegion[regionDistricts[1]] ?? [] });
    }
    if (path === "orders" && method === "POST") {
      mock.orderBodies.push((request.postDataJSON() ?? {}) as Record<string, unknown>);
      mock.orderKeys.push(request.headers()["idempotency-key"]);
      return reply(route, { statusCode: 201, message: "created", data: { id: "10310" } }, 201);
    }
    if (path === "orders/ai-parse" && method === "POST") return reply(route, wrap({ ok: true, orders: parsed }));
    if (path === "orders/ai-confirm" && method === "POST") {
      const body = (request.postDataJSON() ?? {}) as { orders?: unknown[] };
      mock.confirmBodies.push(body as Record<string, unknown>);
      const results = (body.orders ?? []).map((_, index) => ({ index, ok: true, order_id: String(10300 + index) }));
      return reply(route, wrap({ results }));
    }
    if (method !== "GET") {
      mock.leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
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

export const openOperatorOrders = async (page: Page, options: Options = {}, route = "/orders") => {
  const mock = await mockMarketOperatorOrders(page, options);
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Sevara Tojiboyeva").first()).toBeVisible({ timeout: 30_000 });
  return mock;
};

export const openOperatorCreate = async (page: Page, options: Options = {}, route = "/new-orders/create") => {
  const mock = await mockMarketOperatorOrders(page, options);
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1, name: "Yangi buyurtma" })).toBeVisible({ timeout: 90_000 });
  return mock;
};

/** Operatorga yopiq yo'l so'ralmagan va kutilmagan yozish yo'q. */
export const expectNoForbiddenRequests = (mock: MarketOperatorOrdersMock) => {
  expect(mock.requests).toContain("GET auth/my-profile");
  expect(mock.forbidden).toEqual([]);
  expect(mock.leaked).toEqual([]);
};

/** Sahifada gorizontal oqib ketish yo'q (hujjat ham, shell kontenti ham). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};
