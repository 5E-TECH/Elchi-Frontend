import { expect, test, type Page, type Route } from "@playwright/test";
import { expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";
import { enterScanCode } from "./support/universalScanner";

/**
 * 390px, kuryer skan-qabuli (2026-11-07, BeePost `/scan` kuryer qabul sikli), soxta backend:
 *   1) `/scan` «Qabul qilish» rejimi: yo'ldagi o'z buyurtmasi → `PATCH post/receive/:post_id { order_ids: [id], scan: true }`,
 *      kamera yopilmaydi, ro'yxatda «Qabul qilindi»; o'sha kod qayta → «allaqachon qabul qilindi» (so'rovsiz);
 *      qabul qilingan («kutilmoqda») kod → natija sahifasi `/scan/:token` (Sotish / Bekor qilish);
 *   2) natija sahifasi: yo'ldagi → «Qabul qilish» → yangilanadi → «Sotish» → `POST orders/sell/:id` → skanerga
 *      «Qabul qilish» rejimida qaytadi.
 * Faqat ruxsat etilgan yozuvlar (qabul va sotish) — qolgan har qanday yozish `leaked` ga tushadi.
 */
test.use(FAKE_CAMERA);

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
const POST_ID = "p-9";
const ROAD_TOKEN = "c0c0c0c0c0c0c0c0c0c0c301";
const WAITING_TOKEN = "c0c0c0c0c0c0c0c0c0c0c302";
const RESULT_TOKEN = "c0c0c0c0c0c0c0c0c0c0c303";

type Seed = { id: string; name: string; status: string };
const SEEDS: Record<string, Seed> = {
  [ROAD_TOKEN]: { id: "10301", name: "Dilnoza Karimova", status: "on_the_road" },
  [WAITING_TOKEN]: { id: "10302", name: "Jasur Olimov", status: "waiting" },
  [RESULT_TOKEN]: { id: "10303", name: "Madina Rahimova", status: "on_the_road" },
};

const orderOf = (token: string, status: string) => {
  const seed = SEEDS[token];
  return {
    id: seed.id,
    order_number: seed.id,
    status,
    courier_id: COURIER_ID,
    post_id: POST_ID,
    qr_code_token: token,
    where_deliver: "address",
    total_price: 185000,
    paid_amount: 0,
    to_be_paid: 185000,
    product_quantity: 1,
    createdAt: "2026-11-07T08:00:00.000Z",
    comment: null,
    address: "Bunyodkor ko'chasi, 12",
    customer: { id: `c-${seed.id}`, name: seed.name, phone_number: "+998901112233" },
    district: { id: "d1", name: "Chilonzor tumani", region: { id: "r1", name: "Toshkent shahri" } },
    market: { id: "m1", name: "Baraka Shop" },
    items: [{ id: `i-${seed.id}`, product_id: "p1", quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
  };
};

const mockApi = async (page: Page) => {
  const status = new Map(Object.entries(SEEDS).map(([token, seed]) => [token, seed.status]));
  const tokenById = new Map(Object.entries(SEEDS).map(([token, seed]) => [seed.id, token]));
  const receives: Array<{ postId: string; body: unknown }> = [];
  const sells: string[] = [];
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
    const qr = /^orders\/qr-code\/([0-9a-f]{24})$/.exec(path);
    if (qr && status.has(qr[1])) return reply(route, wrap(orderOf(qr[1], status.get(qr[1]) as string)));
    const receive = /^post\/receive\/([^/]+)$/.exec(path);
    if (receive && request.method() === "PATCH") {
      const body = request.postDataJSON() as { order_ids: string[]; scan?: boolean };
      receives.push({ postId: receive[1], body });
      const received: string[] = [];
      const already: string[] = [];
      for (const id of body.order_ids) {
        const token = tokenById.get(id) as string;
        if (status.get(token) === "waiting") already.push(id);
        else {
          status.set(token, "waiting");
          received.push(id);
        }
      }
      return reply(route, {
        ...wrap([]),
        failures: [],
        not_received_order_ids: [],
        received_order_ids: received,
        already_received_order_ids: already,
        remaining_count: 1,
        post_status: "sent",
      });
    }
    const sell = /^orders\/sell\/(\d+)$/.exec(path);
    if (sell && request.method() === "POST") {
      sells.push(sell[1]);
      status.set(tokenById.get(sell[1]) as string, "sold");
      return reply(route, wrap({ id: sell[1], status: "sold" }));
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
  return { receives, sells, leaked };
};

test.describe("Kuryer skan-qabuli, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("«Qabul qilish» rejimi: yo'ldagi kod qabul qilinadi, takror — jim, kutilayotgan — natija sahifasi", async ({ page }) => {
    const api = await mockApi(page);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("radio")).toHaveText(["O'zimga olish", "Qabul qilish", "Ma'lumot"]);
    await page.getByRole("radio", { name: "Qabul qilish" }).click();
    await expect(page.getByRole("radio", { name: "Qabul qilish" })).toHaveAttribute("aria-checked", "true");
    await expectNoHorizontalScroll(page);

    const camera = page.locator("body");
    await enterScanCode(page, camera, ROAD_TOKEN, "Qabul qilish");
    await expect(page.getByText("№10301 · Dilnoza Karimova")).toBeVisible();
    await expect(page.getByText("Qabul qilindi · Chilonzor tumani")).toBeVisible();
    expect(api.receives).toEqual([{ postId: POST_ID, body: { order_ids: ["10301"], scan: true } }]);

    // O'sha kod qayta — so'rovsiz «allaqachon», sahifa o'zgarmaydi.
    await enterScanCode(page, camera, ROAD_TOKEN, "Qabul qilish");
    await expect(page.getByText("№10301 allaqachon qabul qilindi").first()).toBeVisible();
    expect(api.receives).toHaveLength(1);
    await expect(page).toHaveURL(/\/scan$/);

    // Qabul qilingan (kutilmoqda) — natija sahifasi: «Sotish» va «Bekor qilish», «O'zimga olish» yo'q.
    await enterScanCode(page, camera, WAITING_TOKEN, "Qabul qilish");
    await expect(page).toHaveURL(new RegExp(`/scan/${WAITING_TOKEN}$`));
    await expect(page.getByRole("button", { name: "Sotish" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Bekor qilish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "O'zimga olish" })).toHaveCount(0);
    expect(api.receives).toHaveLength(1);
    await expectNoHorizontalScroll(page);
    expect(api.leaked).toEqual([]);
  });

  test("natija sahifasi: «Qabul qilish» → «Sotish» → sotildi → skanerga «Qabul qilish» rejimida qaytadi", async ({ page }) => {
    const api = await mockApi(page);
    await page.goto(`/scan/${RESULT_TOKEN}`);

    const receive = page.getByRole("button", { name: "Qabul qilish" });
    await expect(receive).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "O'zimga olish" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sotish" })).toHaveCount(0);
    await receive.click();
    await expect(page.getByText("Buyurtma qabul qilindi")).toBeVisible();
    expect(api.receives).toEqual([{ postId: POST_ID, body: { order_ids: ["10303"], scan: true } }]);

    const sell = page.getByRole("button", { name: "Sotish" });
    await expect(sell).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);
    await sell.click();
    const dialog = page.getByRole("dialog", { name: "Sotish" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("switch")).toBeVisible();
    await dialog.getByRole("button", { name: "Sotish" }).click();

    await expect(page).toHaveURL(/\/scan$/, { timeout: 30_000 });
    await expect(page.getByRole("radio", { name: "Qabul qilish" })).toHaveAttribute("aria-checked", "true");
    expect(api.sells).toEqual(["10303"]);
    expect(api.leaked).toEqual([]);
  });
});
