import { expect, type Page, type Route } from "@playwright/test";

/**
 * «Bugungi» → pochtani qabul qilish → orqaga: qabul qilingan pochta ro'yxatda qolmasin (Bahodir, 2026-11-04).
 * Soxta backend — filial menejeri (REGIONAL, filial 16) yoki kuryer (id 42):
 *  - «Bugungi»: menejer — `GET post?status=sent&branch_id=16` va zaxira `GET orders?status=on the road`;
 *    kuryer — `GET post/on-the-road`. Qabul qilingan pochta va buyurtmalar bu javoblardan chiqadi;
 *  - `GET post/orders/99` — pochta `sent`, 2 ta «Yo'lda» buyurtma (qabuldan keyin `waiting`, pochta `received`);
 *  - `PATCH post/receive/99` — tanasi yoziladi (`receives`); boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

const BRANCH = { id: "16", name: "Urgut filiali", type: "REGIONAL" };
const REGION = { id: "8", name: "Samarqand", sato_code: "1718" };

const order = (id: string, name: string) => ({
  id,
  createdAt: "2026-11-04T07:00:00.000Z",
  updatedAt: "2026-11-04T07:00:00.000Z",
  market_id: "7",
  customer_id: `c${id}`,
  product_quantity: 1,
  where_deliver: "address",
  total_price: 150000,
  to_be_paid: 150000,
  paid_amount: 0,
  status: "on the road",
  comment: null,
  operator: null,
  post_id: "99",
  qr_code_token: `qr-${id}`,
  customer: { id: `c${id}`, name, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Urgut", region_id: REGION.id, region: REGION },
  region: REGION,
  branch: BRANCH,
  items: [],
});

export const mockMailReceiveToday = async (page: Page, role: "manager" | "courier") => {
  const state = { orders: [order("3101", "Aliyev Vali"), order("3102", "Karimova Nodira")] };
  const receives: Array<{ order_ids: string[] }> = [];
  const leaked: string[] = [];
  const inTransit = () => state.orders.filter((item) => item.status === "on the road");
  const postStatus = () => (inTransit().length > 0 ? "sent" : "received");
  const post = () => ({
    id: "99",
    createdAt: "2026-11-04T07:30:00.000Z",
    updatedAt: "2026-11-04T07:30:00.000Z",
    courier_id: role === "courier" ? "42" : "0",
    post_total_price: inTransit().reduce((sum, item) => sum + item.total_price, 0),
    order_quantity: inTransit().length,
    qr_code_token: "POST-99",
    region_id: REGION.id,
    branch_id: BRANCH.id,
    region: REGION,
    status: postStatus(),
  });
  const todayPosts = () => (postStatus() === "sent" ? [post()] : []);

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data:
          role === "manager"
            ? {
                id: "42",
                role,
                name: "Ravshan Ortiqov",
                status: "active",
                branch_id: BRANCH.id,
                branch_type: "REGIONAL",
                branch: BRANCH,
              }
            : { id: "42", role, name: "Sherzod Alimov", status: "active", region_id: REGION.id },
      });
    }
    if (path === "post" && request.method() === "GET") {
      const rows = url.searchParams.get("status") === "sent" ? todayPosts() : [];
      return reply(route, {
        statusCode: 200,
        data: { data: rows, total: rows.length, page: 1, totalPages: 1, limit: 100 },
      });
    }
    if (path === "post/on-the-road") return reply(route, { statusCode: 200, data: todayPosts() });
    if (
      path === "orders" &&
      request.method() === "GET" &&
      url.searchParams.get("status") === "on the road"
    ) {
      const items = inTransit();
      return reply(route, {
        statusCode: 200,
        data: { items, total: items.length, page: 1, limit: 100 },
      });
    }
    if (path === "post/orders/99") {
      const centerTotal = 0;
      const home = state.orders.filter((item) => item.where_deliver === "address");
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          allOrdersByPostId: state.orders,
          homeOrders: {
            homeOrders: home.length,
            homeOrdersTotalPrice: home.reduce((sum, item) => sum + item.total_price, 0),
          },
          centerOrders: { centerOrders: 0, centerOrdersTotalPrice: centerTotal },
          post: { ...post(), courier: null },
        },
      });
    }
    if (path === "post/receive/99" && request.method() === "PATCH") {
      const body = request.postDataJSON() as { order_ids: string[] };
      receives.push(body);
      state.orders = state.orders.map((item) =>
        body.order_ids.includes(item.id) ? { ...item, status: "waiting" } : item,
      );
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: state.orders,
        not_received_order_ids: [],
      });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("theme", "light");
    window.localStorage.setItem("theme-version", "2");
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({
        accessTokenExpiresAt: far,
        refreshTokenExpiresAt: far,
        refreshTokenWarnAt: far,
      }),
    );
  });
  return { receives, leaked };
};

/**
 * «Bugungi» → pochta №99 → hammasini tanlab qabul qilish → «Bugungi pochtalar» (orqaga): ro'yxatda №99 yo'q,
 * bo'sh holat. Hammasi 30 soniyalik kesh muddati ichida (eski kesh ko'rsatilmasin).
 */
export const runReceiveRemovesTodayMail = async (page: Page, role: "manager" | "courier") => {
  const { receives, leaked } = await mockMailReceiveToday(page, role);
  await page.goto("/mails/today");
  const card = page
    .getByRole("link", { name: /Pochta №99/ })
    .locator("visible=true")
    .first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.click();

  await expect(page).toHaveURL(/\/mails\/99$/);
  await expect(page.getByText("Aliyev Vali").locator("visible=true").first()).toBeVisible({
    timeout: 30_000,
  });
  await page
    .getByText("Barchasini tanlash", { exact: true })
    .locator("visible=true")
    .first()
    .click();
  await page
    .getByRole("button", { name: /Pochtani qabul qilish — 2 ta/ })
    .locator("visible=true")
    .first()
    .click();

  await expect.poll(() => receives).toEqual([{ order_ids: ["3101", "3102"] }]);
  await expect(page.getByText("Aliyev Vali").locator("visible=true")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Bugungi pochtalar" })
    .locator("visible=true")
    .first()
    .click();
  await expect(page).toHaveURL(/\/mails\/today$/);
  await expect(
    page.getByText("Bugun yangi pochta yo'q").locator("visible=true").first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Pochta №99/ })).toHaveCount(0);
  expect(leaked).toEqual([]);
};
