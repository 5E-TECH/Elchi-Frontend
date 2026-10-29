import type { Page, Route } from "@playwright/test";
import { CANCELLED_ORDERS, MARKET_QR } from "./cancelledHandover";

/**
 * Universal skaner (`/scan`) — «Pochtani jo'natish», «Rad etilgan pochta», «Marketga topshirish» rejimlari
 * (Trello vNcGDnNh 2-band) e2e, soxta backend, superadmin. Varaqlar: `GET post/new`, `GET post/rejected`,
 * `GET orders/markets/cancelled`; pochta QR'i — `GET post/scan/:token`; kelinadigan sahifalar: `GET post/orders/:id`,
 * `GET post/orders/rejected/:id`, `GET orders/markets/:id/cancelled`. Yozuvdan faqat market QR
 * (`POST scan/market-cancelled`) ruxsat — qolgani `leaked` ga tushadi.
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

const REGION = { id: "14", name: "Qashqadaryo" };

const mailOrder = (id: string, name: string, token: string, status: string) => ({
  id,
  status,
  qr_code_token: token,
  where_deliver: "address",
  total_price: 185000,
  to_be_paid: 185000,
  paid_amount: 0,
  createdAt: "2026-10-25T08:00:00.000Z",
  updatedAt: "2026-10-25T08:00:00.000Z",
  comment: null,
  address: "Mustaqillik ko'chasi, 21",
  customer: { id: `c${id}`, name, phone_number: "+998914521830" },
  market: { id: "m-1", name: "Baraka Shop" },
  district: { id: "d-1", name: "Qarshi sh.", region_id: REGION.id, region: REGION },
  region: REGION,
  items: [],
});

/** Yangi (jo'natiladigan) pochta №2483 — 3 ta buyurtma. */
export const SEND_MAIL_ID = "2483";
export const SEND_ORDER_TOKEN = "dddddddddddddddddddd0212";
const SEND_ORDERS = [
  mailOrder("10212", "Shoxrux Rahmonov", SEND_ORDER_TOKEN, "received"),
  mailOrder("10209", "Mohira Ergasheva", "dddddddddddddddddddd0209", "received"),
  mailOrder("10207", "Laylo Hasanova", "dddddddddddddddddddd0207", "received"),
];

/** Rad etilgan pochta №2476 — kuryer qaytargan 2 ta buyurtma; yorlig'idagi QR. */
export const REFUSED_MAIL_ID = "2476";
export const REFUSED_MAIL_QR = "POST-mh2k9x-e2e1";
const REFUSED_ORDERS = [
  mailOrder("10188", "Zarina Usmonova", "dddddddddddddddddddd0188", "cancelled"),
  mailOrder("10185", "Bekzod Murodov", "dddddddddddddddddddd0185", "cancelled"),
];

export const mockUniversalScanModesApi = async (page: Page) => {
  const leaked: string[] = [];
  const marketQrScans: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active" }));
    }
    if (path === "post/new") {
      return reply(
        route,
        wrap([
          {
            id: SEND_MAIL_ID,
            status: "new",
            order_quantity: SEND_ORDERS.length,
            post_total_price: 555000,
            region_id: REGION.id,
            region: REGION,
            createdAt: "2026-10-25T08:00:00.000Z",
          },
        ]),
      );
    }
    if (path === "post/rejected") {
      return reply(
        route,
        wrap([
          {
            id: REFUSED_MAIL_ID,
            status: "canceled",
            order_quantity: REFUSED_ORDERS.length,
            post_total_price: 370000,
            region_id: REGION.id,
            region: REGION,
            courier: { id: "31", name: "Akmal Karimov" },
            createdAt: "2026-10-24T08:00:00.000Z",
          },
        ]),
      );
    }
    if (path === `post/orders/${SEND_MAIL_ID}`) {
      return reply(
        route,
        wrap({
          allOrdersByPostId: SEND_ORDERS,
          homeOrders: { homeOrders: 0, homeOrdersTotalPrice: 0 },
          centerOrders: { centerOrders: 0, centerOrdersTotalPrice: 0 },
          post: { id: SEND_MAIL_ID, status: "new", region_id: REGION.id, region: REGION, createdAt: "2026-10-25T08:00:00.000Z" },
        }),
      );
    }
    if (path === `post/orders/rejected/${REFUSED_MAIL_ID}`) return reply(route, wrap(REFUSED_ORDERS));
    if (path === `post/scan/${REFUSED_MAIL_QR}`) {
      return reply(
        route,
        wrap({ id: REFUSED_MAIL_ID, status: "canceled", region_id: REGION.id, order_quantity: REFUSED_ORDERS.length, qr_code_token: REFUSED_MAIL_QR }),
      );
    }
    if (path === "orders/markets/cancelled") {
      return reply(
        route,
        wrap([{ market_id: "201", orders_count: CANCELLED_ORDERS.length, total_price_sum: 761000, market: { id: "201", name: "Baraka Shop" } }]),
      );
    }
    if (path === "orders/markets/201/cancelled") return reply(route, wrap(CANCELLED_ORDERS));
    if (path === "scan/market-cancelled" && request.method() === "POST") {
      marketQrScans.push((request.postDataJSON() as { qr_token: string }).qr_token);
      return reply(route, wrap({ authorization_token: "auth-e2e", remaining_seconds: 300 }));
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
  return { leaked, marketQrScans, marketQr: MARKET_QR };
};
