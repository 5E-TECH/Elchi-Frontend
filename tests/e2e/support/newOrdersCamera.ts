import { expect, type Page, type Route } from "@playwright/test";

/**
 * Market yangi buyurtmalari (`/new-orders/:marketId`) — kamera (Trello v1eLN2tV 2-bosqich) e2e, soxta backend.
 * Markaziy «Skaner» tugmasi shu sahifaning skan maqsadini ochadi: skan = darhol qabul; boshqa marketning
 * buyurtmasi server tekshiruvidan keyin rad etiladi; kamera ichida market almashtiriladi.
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
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const MARKETS = {
  "121": "Ipak Yo'li Savdo",
  "122": "Baraka Shop",
} as const;

const order = (id: string, token: string, name: string, marketId: keyof typeof MARKETS) => ({
  id,
  status: "new",
  where_deliver: "address",
  total_price: 96000,
  paid_amount: 0,
  to_be_paid: 96000,
  createdAt: "2026-10-19T08:00:00.000Z",
  comment: null,
  address: "Farg'ona",
  qr_code_token: token,
  market_id: marketId,
  items: [{ id: `i-${id}`, product_id: "p1", quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
  customer: { id: `c-${id}`, name, phone_number: "+998901112233" },
  district: { id: "d1", name: "Farg'ona sh.", region: { id: "r1", name: "Farg'ona viloyati" } },
  market: { id: marketId, name: MARKETS[marketId] },
});

export const OWN_TOKEN = "aaaaaaaaaaaaaaaaaaaaaa54";
export const OTHER_TOKEN = "bbbbbbbbbbbbbbbbbbbbbb27";
const ORDERS = {
  "121": [order("10254", OWN_TOKEN, "Sanjar Mirzayev", "121"), order("10253", "aaaaaaaaaaaaaaaaaaaaaa53", "Gulnoza Hamidova", "121")],
  "122": [order("10327", OTHER_TOKEN, "Dilshod Rajabov", "122")],
};

/** HQ menejeri (qabul — `POST orders/receive`, «Qabul qilish» rejimi universal skanerda) — 3-bosqich e2e. */
export const HQ_MANAGER_PROFILE = {
  id: "7",
  role: "manager",
  name: "Menejer",
  status: "active",
  branch_id: "1",
  branch: { id: "1", name: "Toshkent HQ", type: "HQ" },
};

export const mockNewOrdersCameraApi = async (
  page: Page,
  { profile = { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } }: { profile?: Record<string, unknown> } = {},
) => {
  const leaked: string[] = [];
  const received: string[][] = [];
  const receivedIds = new Set<string>();
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap(profile));
    }
    const marketNew = /^orders\/markets\/(\d+)\/new$/.exec(path);
    if (marketNew) {
      const list = (ORDERS[marketNew[1] as keyof typeof ORDERS] ?? []).filter((item) => !receivedIds.has(item.id));
      return reply(route, wrap(list));
    }
    if (path === "orders/markets/new") {
      return reply(
        route,
        wrap(
          (Object.keys(MARKETS) as (keyof typeof MARKETS)[]).map((id) => ({
            market_id: id,
            orders_count: ORDERS[id].filter((item) => !receivedIds.has(item.id)).length,
            total_price_sum: 96000,
            market: { id, name: MARKETS[id], phone_number: "+998900000000" },
          })),
        ),
      );
    }
    const byQr = /^orders\/qr-code\/(.+)$/.exec(path);
    if (byQr) {
      const found = Object.values(ORDERS).flat().find((item) => item.qr_code_token === decodeURIComponent(byQr[1]));
      return found ? reply(route, wrap(found)) : reply(route, { statusCode: 404, message: "Order not found" }, 404);
    }
    if (path === "orders/receive" && request.method() === "POST") {
      const ids = (request.postDataJSON() as { order_ids: string[] }).order_ids;
      received.push(ids);
      ids.forEach((id) => receivedIds.add(id));
      return reply(route, wrap({ received: ids.length }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
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
  return { leaked, received };
};

export const openMarket = async (page: Page) => {
  await page.goto("/new-orders/121");
  await expect(page.getByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" })).toBeVisible({ timeout: 60_000 });
};

/** Kamera oynasi (telefonda to'liq ekran) — sarlavha «Qabul qilish». */
export const cameraDialog = (page: Page) => page.getByRole("dialog", { name: "Qabul qilish" });
