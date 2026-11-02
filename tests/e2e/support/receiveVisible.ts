import { expect, type Page, type Route } from "@playwright/test";

/**
 * ndKkHjhe — uzun ro'yxatda (50 ta) «Qabul qilish — N ta …» sahifa sarlavhasi amallarida: market yangi buyurtmalari
 * (`/new-orders/:marketId`) va filial paketi (`/new-orders/branches/:branchId/batches/:batchId`). Soxta backend.
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
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const ORDER_COUNT = 50;
const createdAt = new Date().toISOString();
const ids = Array.from({ length: ORDER_COUNT }, (_, i) => String(10300 - i));
const customer = (i: number) => ["Sanjar Mirzayev", "Gulnoza Hamidova", "Dilshod Rajabov", "Malika Yusupova"][i % 4];

const MARKET_ORDERS = ids.map((id, i) => ({
  id,
  status: "new",
  where_deliver: i % 2 ? "center" : "address",
  total_price: 96000 + i * 1000,
  paid_amount: 0,
  to_be_paid: 96000,
  createdAt,
  qr_code_token: `qr-${id}`,
  market_id: "121",
  items: [{ id: `i-${id}`, product_id: "p1", quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
  customer: { id: `c-${id}`, name: customer(i), phone_number: "+998901112233" },
  district: { id: "d1", name: "Farg'ona sh.", region: { id: "r1", name: "Farg'ona viloyati" } },
  market: { id: "121", name: "Ipak Yo'li Savdo" },
}));

const BATCH = {
  id: "172",
  qr_code_token: "BTB-172",
  source_branch: { id: "7", name: "Urgut filiali", code: "SMQ-URG" },
  destination_branch: { id: "1", name: "Toshkent HQ" },
  direction: "FORWARD",
  status: "SENT",
  order_count: ORDER_COUNT,
  total_price: ORDER_COUNT * 189000,
  createdAt,
  region: { id: "14", name: "Samarqand viloyati" },
  items: ids.map((id, i) => ({
    id: `i${id}`,
    order_id: id,
    snapshot_price: 189000,
    order: {
      id,
      status: "on_the_road",
      where_deliver: i % 2 ? "center" : "address",
      total_price: 189000,
      createdAt,
      address: "Mustaqillik ko'chasi, 14-uy",
      qr_code_token: `qr-${id}`,
      customer: { id: `c${id}`, name: customer(i), phone_number: "+998912451780" },
      district: { id: "d1", name: "Urgut tumani" },
    },
  })),
  history: [],
};

export const mockReceiveVisible = async (page: Page, theme: "light" | "dark" = "light") => {
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active", settings: { appearance: { theme, themeChosen: true } } }),
      );
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    if (path === "orders/markets/121/new") return reply(route, wrap(MARKET_ORDERS));
    if (path === "orders/markets/new") {
      return reply(
        route,
        wrap([{ market_id: "121", orders_count: ORDER_COUNT, total_price_sum: 4_800_000, market: { id: "121", name: "Ipak Yo'li Savdo" } }]),
      );
    }
    if (path === "transfer-batches/172" || path === "transfer-batches/172/remaining") return reply(route, BATCH);
    if (path === "branches/7") return reply(route, wrap({ id: "7", name: "Urgut filiali" }));
    if (path === "branches/1") return reply(route, wrap({ id: "1", name: "Toshkent HQ" }));
    return reply(route, wrap([]));
  });
  await page.addInitScript((theme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", theme);
  }, theme);
};

export const MARKET_PATH = "/new-orders/121";
export const BATCH_PATH = "/new-orders/branches/7/batches/172";

/** ≥ 768 — sarlavhada, telefonda — pastki menyu ustidagi panelda (tugma bitta). */
export const receiveButton = (page: Page) =>
  page.locator("#main-content").getByRole("button", { name: /^Qabul qilish/ });

/** Element to'liq ko'rinadigan oynada (yuqori panel va pastki menyu orasida). */
export const expectInViewport = async (page: Page, locator: ReturnType<Page["locator"]>) => {
  const box = (await locator.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
};
