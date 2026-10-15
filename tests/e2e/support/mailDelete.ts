import { expect, type Page, type Route } from "@playwright/test";

/**
 * Pochta tafsiloti → savat: buyurtmani pochtadan o'chirish (yokjwjXG) — soxta backend.
 * `POST /post/delete` backend kabi: sabab 3..500 belgi; `conflictIds` dagi buyurtma — 409.
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

const order = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  createdAt: "2026-10-15T08:00:00.000Z",
  updatedAt: "2026-10-15T08:00:00.000Z",
  market_id: "7",
  customer_id: `c${id}`,
  product_quantity: 1,
  where_deliver: "center",
  total_price: 150000,
  to_be_paid: 150000,
  paid_amount: 0,
  status: "received",
  comment: null,
  operator: null,
  customer: { id: `c${id}`, name, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Chilonzor", region_id: "1", region: { id: "1", name: "Toshkent" } },
  region: { id: "1", name: "Toshkent" },
  items: [],
  ...over,
});

export const mockMailDeleteApi = async (
  page: Page,
  { postStatus = "new", conflictIds = [] as string[] } = {},
) => {
  const state = { orders: [order("1251", "Aliyev Vali"), order("1252", "Karimova Nodira"), order("1253", "Sobirov Jasur")] };
  const deletes: Array<{ body: Record<string, unknown>; status: number }> = [];
  const leaked: string[] = [];
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
    if (path === "post/orders/74") {
      const total = state.orders.reduce((sum, item) => sum + item.total_price, 0);
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          allOrdersByPostId: state.orders,
          homeOrders: { homeOrders: 0, homeOrdersTotalPrice: 0 },
          centerOrders: { centerOrders: state.orders.length, centerOrdersTotalPrice: total },
          post: { id: "74", status: postStatus },
        },
      });
    }
    if (path === "post/delete" && request.method() === "POST") {
      const body = request.postDataJSON() as { post_id: string; order_ids: string[]; reason: string };
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 3 || reason.length > 500) {
        deletes.push({ body, status: 400 });
        return reply(route, { statusCode: 400, message: "reason 3..500" }, 400);
      }
      const conflict = body.order_ids.find((id) => conflictIds.includes(id));
      if (conflict) {
        deletes.push({ body, status: 409 });
        return reply(route, { statusCode: 409, message: `#${conflict} — buyurtma kuryer qo'lida` }, 409);
      }
      state.orders = state.orders.filter((item) => !body.order_ids.includes(item.id));
      deletes.push({ body, status: 200 });
      return reply(route, {
        statusCode: 200,
        data: {
          post_id: "74",
          deleted: body.order_ids,
          skipped: [],
          post_deleted: state.orders.length === 0,
          order_quantity: state.orders.length,
          post_total_price: state.orders.reduce((sum, item) => sum + item.total_price, 0),
        },
      });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
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
  return { state, deletes, leaked };
};

export const openMailDetail = async (page: Page) => {
  await page.goto("/mails/74");
  await expect(page.getByText("Aliyev Vali").locator("visible=true").first()).toBeVisible({ timeout: 60_000 });
};
