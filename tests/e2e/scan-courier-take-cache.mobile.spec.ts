import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * 390px, kuryer QR skani (Trello 6qypMFeT): «O'zimga olish» dan keyin keshlar yangilanadi.
 *   1) `POST orders/scan-assign` 200 → ilovadan chiqmasdan «Buyurtmalar» ga qaytilsa ro'yxat (`GET orders/courier/orders`)
 *      QAYTA so'raladi — global 30 s keshda eski ro'yxat qolmaydi;
 *   2) o'sha QR qayta ochilsa skan natijasi ham qayta so'raladi va buyurtma endi shu kuryerda — «O'zimga olish» faol
 *      emas, «Bu buyurtma allaqachon sizda».
 * Sahifalar orasida ilova ichida o'tiladi (`history.pushState` + `popstate`) — to'liq qayta yuklash keshni o'chirib,
 * tekshiruvni ma'nosiz qilardi.
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
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const COURIER_ID = "31";
const TOKEN = "c0c0c0c0c0c0c0c0c0c0c214";

const order = (assigned: boolean) => ({
  id: "10214",
  status: assigned ? "on_the_road" : "received",
  courier_id: assigned ? COURIER_ID : null,
  qr_code_token: TOKEN,
  where_deliver: "address",
  total_price: 185000,
  paid_amount: 0,
  to_be_paid: 185000,
  createdAt: "2026-10-26T08:00:00.000Z",
  comment: null,
  address: "Bunyodkor ko'chasi, 12",
  customer: { id: "c-10214", name: "Zarina Yo'ldosheva", phone_number: "+998901112233" },
  district: { id: "d1", name: "Chilonzor tumani", region: { id: "r1", name: "Toshkent shahri" } },
  market: { id: "m1", name: "Baraka Shop" },
  items: [{ id: "i1", product_id: "p1", quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
});

const mockApi = async (page: Page) => {
  const state = { assigned: false, listCalls: 0, detailCalls: 0, assigns: 0 };
  const leaked: string[] = [];
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
        wrap({ id: COURIER_ID, role: "courier", name: "Kuryer", status: "active", branch_id: "2", branch: { id: "2", name: "Chilonzor", type: "REGIONAL" } }),
      );
    }
    if (path === "orders/courier/orders/counts") {
      return reply(route, wrap({ waiting: state.assigned ? 1 : 0, all: state.assigned ? 1 : 0, cancelled: 0 }));
    }
    if (path === "orders/courier/orders") {
      state.listCalls += 1;
      const items = state.assigned ? [order(true)] : [];
      return reply(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 10 });
    }
    if (path === `orders/qr-code/${TOKEN}`) {
      state.detailCalls += 1;
      return reply(route, wrap(order(state.assigned)));
    }
    if (path === "orders/scan-assign" && request.method() === "POST") {
      state.assigns += 1;
      state.assigned = true;
      return reply(route, wrap({ idempotent: false, order_id: "10214", post_id: "p-1", post_created: false }));
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
  return { state, leaked };
};

/** Ilova ichida o'tish (kesh saqlanadi) — react-router `popstate` ni tinglaydi. */
const goInApp = (page: Page, to: string) =>
  page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, to);

const takeOrder = async (page: Page) => {
  const take = page.getByRole("button", { name: "O'zimga olish" });
  await expect(take).toBeEnabled({ timeout: 60_000 });
  await take.click();
  await expect(page.getByText("Buyurtma sizga biriktirildi")).toBeVisible();
  // Muvaffaqiyatdan 1,5 s keyin skaner o'zi qayta ochiladi.
  await expect(page).toHaveURL(/\/scan$/, { timeout: 10_000 });
};

test.describe("Kuryer QR: «O'zimga olish» dan keyin kesh (6qypMFeT), 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("scan-assign 200 → «Buyurtmalar» ga ilova ichida qaytilsa ro'yxat qayta so'raladi", async ({ page }) => {
    const { state, leaked } = await mockApi(page);
    await page.goto("/orders");
    await expect(page.getByRole("tablist", { name: "Buyurtmalar turi" })).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => state.listCalls).toBeGreaterThan(0);
    const before = state.listCalls;

    await goInApp(page, `/scan/${TOKEN}`);
    await takeOrder(page);
    expect(state.assigns).toBe(1);

    // 30 s keshlash oynasi ichida qaytildi — yangilanish faqat skan amalidagi invalidatsiya tufayli.
    await goInApp(page, "/orders");
    await expect(page.getByRole("tablist", { name: "Buyurtmalar turi" })).toBeVisible();
    await expect.poll(() => state.listCalls).toBeGreaterThan(before);
    expect(leaked).toEqual([]);
  });

  test("o'sha QR qayta ochilsa — yangi holat: «Bu buyurtma allaqachon sizda», «O'zimga olish» faol emas", async ({ page }) => {
    const { state, leaked } = await mockApi(page);
    await page.goto(`/scan/${TOKEN}`);
    await takeOrder(page);
    expect(state.detailCalls).toBe(1);

    await goInApp(page, `/scan/${TOKEN}`);
    await expect(page.getByText("Bu buyurtma allaqachon sizda")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "O'zimga olish" })).toBeDisabled();
    expect(state.detailCalls).toBe(2);
    expect(state.assigns).toBe(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
