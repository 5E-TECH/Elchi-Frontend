import { expect, type Page, type Route } from "@playwright/test";

/**
 * Buyurtma detal sahifasi (`/orders/edit/:id`) e2e testlari uchun soxta backend.
 * Hech qanday so'rov serverga ketmaydi; yozuvchi so'rov `leaked` ga tushadi.
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

/** Karta dalilidagi #95 (kerakli maydonlar), qisman sotuvdan qolgan qism sifatida. */
export const ORDER_96 = {
  id: "96",
  status: "waiting",
  where_deliver: "address",
  total_price: 150000,
  to_be_paid: 150000,
  paid_amount: 0,
  comment: null,
  address: "Chilonzor 19-kvartal, 45-uy",
  customer: { id: "c1", name: "Aliyev Vali", phone_number: "+998901234567" },
  market: { id: "m7", name: "Kimdur Kimdur", phone_number: "+998992222222" },
  market_tariff: 70000,
  courier_tariff: 25000,
  courier_share: 25000,
  branch_share: 0,
  courier_id: "93",
  post_id: "78",
  holder_type: "COURIER",
  holder_courier_id: "93",
  sold_at: null,
  branch: { id: "1", name: "HQ Toshkent" },
  parent_order_id: "95",
  items: [],
};

export interface OrderDetailMockOptions {
  /** `auth/my-profile` javobi (sukut — admin). */
  profile?: Record<string, unknown>;
  /** Ruxsat berilgan yozuvchi so'rov: qiymat qaytarsa — javob shu, so'rov `writes` ga yoziladi. */
  onWrite?: (method: string, path: string) => unknown;
  /** `GET orders/:id/tracking` hodisalari (har so'rovda chaqiriladi — o'zgarishi mumkin). */
  tracking?: () => unknown[];
  /** Qo'shimcha buyurtmalar (masalan ota buyurtma) — `GET orders/:id` ularni ham qaytaradi. */
  extraOrders?: Record<string, unknown>[];
}

/** Karta dalilidagi `GET /orders/95` javobi (sotilgan, kuryer qo'lida). */
export const ORDER_95 = {
  id: "95",
  status: "sold",
  where_deliver: "address",
  total_price: 150000,
  to_be_paid: 0,
  paid_amount: 150000,
  comment: null,
  address: "Chilonzor 19-kvartal, 45-uy",
  customer: { id: "c1", name: "Aliyev Vali", phone_number: "+998901234567" },
  market: { id: "m7", name: "Kimdur Kimdur", phone_number: "+998992222222" },
  market_tariff: 70000,
  courier_tariff: 25000,
  courier_share: 25000,
  branch_share: 0,
  courier_id: "93",
  post_id: "78",
  holder_type: "COURIER",
  holder_courier_id: "93",
  sold_at: "1784557174975",
  createdAt: "2026-07-20T08:38:49.865Z",
  branch: { id: "1", name: "HQ Toshkent" },
  parent_order_id: null,
  items: [],
};

export const mockOrderDetailApi = async (
  page: Page,
  order: Record<string, unknown> = ORDER_96,
  options: OrderDetailMockOptions = {},
) => {
  const leaked: string[] = [];
  const writes: string[] = [];
  /** Backendga ketgan barcha so'rovlar tartibi bilan (`GET orders/96`, `POST ...`). */
  const requests: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    requests.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(route, wrap(options.profile ?? { id: "1", role: "admin", name: "E2E admin", status: "active" }));
    }
    if (path === `orders/${order.id}`) return reply(route, wrap(order));
    const extra = options.extraOrders?.find((item) => path === `orders/${item.id}`);
    if (extra) return reply(route, wrap(extra));
    if (path === `orders/${order.id}/tracking` && options.tracking) {
      const events = options.tracking();
      return reply(route, { data: events, total: events.length, page: 1, limit: 20 });
    }
    if (path === "users/93") {
      return reply(route, wrap({ id: "93", name: "Xorazm Courier", phone_number: "+998970000090" }));
    }
    if (request.method() !== "GET") {
      const allowed = options.onWrite?.(request.method(), path);
      if (allowed !== undefined) {
        writes.push(`${request.method()} ${path}`);
        return reply(route, allowed);
      }
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
  return { leaked, writes, requests };
};

export const openOrderDetail = async (page: Page, id = "96") => {
  await page.goto(`/orders/edit/${id}`);
  await expect(page.getByTestId("order-meta")).toBeVisible({ timeout: 60_000 });
};
