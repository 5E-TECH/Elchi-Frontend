import { expect, type Page, type Route } from "@playwright/test";

/**
 * Pochta tafsiloti — skan = darhol qabul (2026-11-07, BeePost kabi). Soxta backend — kuryer (id 42, o'z pochtasi)
 * yoki filial menejeri (REGIONAL, filial 16, kuryersiz o'tkazma pochtasi):
 *  - `GET post/orders/99` — pochta `sent`, 2 ta «Yo'lda» buyurtma (qabul qilingani `waiting`; hammasi qabul
 *    qilinsa pochta `received`);
 *  - `PATCH post/receive/99` — tanasi yoziladi (`receives`); `scan: true` da faqat `order_ids` qabul qilinadi,
 *    javobda `received_order_ids` / `already_received_order_ids` / `not_received_order_ids` / `post_status`;
 *  - boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const BRANCH = { id: "16", name: "Urgut filiali", type: "REGIONAL" };
const REGION = { id: "8", name: "Samarqand", sato_code: "1718" };

const order = (id: string, name: string) => ({
  id,
  createdAt: "2026-11-07T07:00:00.000Z",
  updatedAt: "2026-11-07T07:00:00.000Z",
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
  qr_code_token: `qr-${id}-e2e`,
  customer: { id: `c${id}`, name, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Urgut", region_id: REGION.id, region: REGION },
  region: REGION,
  branch: BRANCH,
  items: [],
});

export type ScanReceiveRole = "courier" | "manager";

export const mockMailScanReceive = async (page: Page, role: ScanReceiveRole) => {
  const state = { orders: [order("3101", "Aliyev Vali"), order("3102", "Karimova Nodira")] };
  const receives: Array<{ order_ids: string[]; scan?: boolean }> = [];
  const leaked: string[] = [];
  const inTransit = () => state.orders.filter((item) => item.status === "on the road");
  const postStatus = () => (inTransit().length > 0 ? "sent" : "received");
  const post = () => ({
    id: "99",
    createdAt: "2026-11-07T07:30:00.000Z",
    updatedAt: "2026-11-07T07:30:00.000Z",
    courier_id: role === "courier" ? "42" : "0",
    post_total_price: inTransit().reduce((sum, item) => sum + item.total_price, 0),
    order_quantity: state.orders.length,
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
            ? { id: "42", role, name: "Ravshan Ortiqov", status: "active", branch_id: BRANCH.id, branch_type: "REGIONAL", branch: BRANCH }
            : { id: "42", role, name: "Sherzod Alimov", status: "active", region_id: REGION.id },
      });
    }
    if (path === "post" && request.method() === "GET") {
      const rows = url.searchParams.get("status") === "sent" ? todayPosts() : [];
      return reply(route, { statusCode: 200, data: { data: rows, total: rows.length, page: 1, totalPages: 1, limit: 100 } });
    }
    if (path === "post/on-the-road") return reply(route, { statusCode: 200, data: todayPosts() });
    if (path === "post/orders/99") {
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
          centerOrders: { centerOrders: 0, centerOrdersTotalPrice: 0 },
          post: { ...post(), courier: null },
        },
      });
    }
    if (path === "post/receive/99" && request.method() === "PATCH") {
      const body = request.postDataJSON() as { order_ids: string[]; scan?: boolean };
      receives.push(body);
      const already = body.order_ids.filter((id) => state.orders.find((item) => item.id === id)?.status === "waiting");
      const received = body.order_ids.filter((id) => state.orders.find((item) => item.id === id)?.status === "on the road");
      state.orders = state.orders.map((item) => (received.includes(item.id) ? { ...item, status: "waiting" } : item));
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: state.orders.filter((item) => received.includes(item.id)),
        failures: [],
        not_received_order_ids: [],
        received_order_ids: received,
        already_received_order_ids: already,
        remaining_count: inTransit().length,
        post_status: postStatus(),
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
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { receives, leaked };
};

/** USB skaner — klaviatura kabi tez yozadi va Enter bosadi (maydonda emas, sahifada). */
const usbScan = async (page: Page, value: string) => {
  await page.keyboard.type(value, { delay: 10 });
  await page.keyboard.press("Enter");
};

/**
 * «Bugungi» → pochta №99 → USB skan: har skan — `PATCH post/receive/99 {order_ids: [id], scan: true}`, qator
 * darhol yo'qoladi (belgi qo'yilmaydi); qayta skan — so'rovsiz «Allaqachon qabul qilingan»; oxirgisi qabul qilinsa —
 * «Pochta to'liq qabul qilindi» va «Bugungi»ga qaytiladi.
 */
export const runMailScanReceive = async (page: Page, role: ScanReceiveRole) => {
  const { receives, leaked } = await mockMailScanReceive(page, role);
  await page.goto("/mails/today");
  const card = page.getByRole("link", { name: /Pochta №99/ }).locator("visible=true").first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.click();

  await expect(page).toHaveURL(/\/mails\/99$/);
  const first = page.getByText("Aliyev Vali").locator("visible=true").first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("Skanerlang — buyurtma darhol qabul qilinadi va ro'yxatdan chiqadi").locator("visible=true").first(),
  ).toBeVisible();
  // Fokus sahifada (qidiruv maydonida emas).
  await page.getByRole("heading", { level: 1 }).first().click();

  await usbScan(page, "qr-3101-e2e");
  await expect.poll(() => receives).toEqual([{ order_ids: ["3101"], scan: true }]);
  await expect(page.getByText("Aliyev Vali").locator("visible=true")).toHaveCount(0);
  await expect(page.getByText("Karimova Nodira").locator("visible=true").first()).toBeVisible();
  await expect(page.getByText("№3101 qabul qilindi · 1 ta qoldi").first()).toBeVisible();
  // Hech narsa belgilanmagan — qo'lda qabul tugmasi «0 ta».
  await expect(
    page.getByRole("button", { name: /Pochtani qabul qilish — 0 ta/ }).locator("visible=true").first(),
  ).toBeDisabled();

  // Qayta skan — so'rovsiz.
  await usbScan(page, "qr-3101-e2e");
  await expect(page.getByText("Allaqachon qabul qilingan №3101").first()).toBeVisible();
  expect(receives).toHaveLength(1);

  await usbScan(page, "qr-3102-e2e");
  await expect
    .poll(() => receives)
    .toEqual([
      { order_ids: ["3101"], scan: true },
      { order_ids: ["3102"], scan: true },
    ]);
  await expect(page.getByText("Pochta to'liq qabul qilindi").first()).toBeVisible();
  await expect(page).toHaveURL(/\/mails\/today$/, { timeout: 10_000 });
  await expect(page.getByText("Bugun yangi pochta yo'q").locator("visible=true").first()).toBeVisible();
  expect(leaked).toEqual([]);
};
