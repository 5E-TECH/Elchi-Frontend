import { expect, type Locator, type Page, type Route } from "@playwright/test";

/**
 * Kuryer → Buyurtmalar → «Bekor qilish» / «Sotish» oynalari — soxta backend.
 * `POST /orders/cancel/:id` backend kabi: `reason` yo'q yoki `OTHER` izohsiz — 400,
 * `paidAmount > 0` — 400 (GNWDKvmZ, uguUEhin).
 * `POST /orders/sell/:id { paidAmount }` → `data.status`: to'liq — `paid`,
 * qisman — `partly_paid`, yo'q — `sold`; `to_be_paid` dan oshsa 400.
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
  created_at: "2026-10-15T08:00:00.000Z",
  status: "waiting",
  total_price: 310000,
  to_be_paid: 280000,
  where_deliver: "address",
  product_quantity: 1,
  market: { name: "Ipak Yo'li Savdo" },
  customer: { name, phone_number: "+998993057164" },
  district: { name: "Toshkent tumani" },
  region: { name: "Toshkent viloyati" },
  items: [],
  ...over,
});

export const mockCourierCancelApi = async (page: Page, theme: "light" | "dark" = "light") => {
  const state = {
    orders: [order("10234", "Feruza Mirzayeva"), order("10235", "Jasur Karimov")],
    /** OR-1: ro'yxat so'rovi 500 qaytaradi (yangilash xatosi). */
    listFail: false,
    /** OR-1: ro'yxat va tab sonlari javobi shuncha kechikadi (ms) — «Yangilanmoqda…» holati. */
    listDelayMs: 0,
    /** OR-1: `GET orders/courier/orders` va `…/counts` so'rovlari soni. */
    listCalls: 0,
    countCalls: 0,
  };
  const cancels: Array<{ id: string; body: Record<string, unknown>; status: number }> = [];
  const sells: Array<{ id: string; body: Record<string, unknown>; status: number }> = [];
  const leaked: string[] = [];
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
        data: {
          id: "26",
          role: "courier",
          name: "TEST Kuryer",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "orders/courier/orders/counts") {
      // OR-1 (0d11ewk7): kuryer tablari soni — ro'yxat `total` i bilan bir xil.
      state.countCalls += 1;
      if (state.listDelayMs) await new Promise((done) => setTimeout(done, state.listDelayMs));
      if (state.listFail) return reply(route, { statusCode: 500, message: "e2e: internal" }, 500);
      return reply(route, {
        statusCode: 200,
        message: "Courier order counts",
        data: { waiting: state.orders.length, all: state.orders.length + 3, cancelled: 1 },
      });
    }
    if (path === "orders/courier/orders") {
      state.listCalls += 1;
      if (state.listDelayMs) await new Promise((done) => setTimeout(done, state.listDelayMs));
      if (state.listFail) return reply(route, { statusCode: 500, message: "e2e: internal" }, 500);
      return reply(route, { statusCode: 200, data: state.orders, total: state.orders.length, page: 1, limit: 10 });
    }
    const cancel = /^orders\/cancel\/(\w+)$/.exec(path);
    if (cancel && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const invalid = Number(body.paidAmount ?? 0) > 0
        ? "paidAmount bekor qilishda qabul qilinmaydi — faqat 0 bo'lishi mumkin"
        : !body.reason
        ? "Bekor qilish sababi majburiy — reason tanlang yoki izoh yozing"
        : body.reason === "OTHER" && !String(body.comment ?? "").trim()
          ? "Sabab 'boshqa' (OTHER) bo'lsa izoh (comment) majburiy"
          : null;
      cancels.push({ id: cancel[1], body, status: invalid ? 400 : 200 });
      if (invalid) return reply(route, { statusCode: 400, message: invalid }, 400);
      state.orders = state.orders.filter((item) => item.id !== cancel[1]);
      return reply(route, { statusCode: 200, message: "Order canceled", data: { id: cancel[1], status: "cancelled" } });
    }
    const sell = /^orders\/sell\/(\w+)$/.exec(path);
    if (sell && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const target = state.orders.find((item) => item.id === sell[1]);
      const paid = Number(body.paidAmount ?? 0);
      const max = Number(target?.to_be_paid ?? 0) - Number(body.extraCost ?? 0);
      if (paid > max) {
        sells.push({ id: sell[1], body, status: 400 });
        return reply(route, { statusCode: 400, message: `paidAmount ${max} dan oshmasligi kerak` }, 400);
      }
      sells.push({ id: sell[1], body, status: 200 });
      state.orders = state.orders.filter((item) => item.id !== sell[1]);
      const status = paid <= 0 ? "sold" : paid >= max ? "paid" : "partly_paid";
      return reply(route, { statusCode: 200, message: "Order sold", data: { id: sell[1], status, paid_amount: paid } });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((t) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", t);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return { state, cancels, sells, leaked };
};

/**
 * Ro'yxatdagi birinchi «Bekor qilish» → oyna. Qator tugmasi nomi maketdagidek (dizayn v2):
 * kompyuterda «№10234 ni bekor qilish», telefonda «Feruza Mirzayeva: bekor qilish».
 */
export const openCancelDialog = async (page: Page) => {
  await page.goto("/orders");
  const rowAction = page.getByRole("button", { name: /(ni|:) bekor qilish$/ }).first();
  await expect(rowAction).toBeVisible({ timeout: 60_000 });
  await rowAction.click();
  const dialog = page.getByRole("dialog", { name: "Buyurtmani bekor qilish" });
  await expect(dialog).toBeVisible();
  return dialog;
};

/** Ro'yxatdagi birinchi «Sotish» → oyna (qator tugmasi: «№10234 ni sotish» / «Feruza Mirzayeva: sotish»). */
export const openSellDialog = async (page: Page) => {
  await page.goto("/orders");
  const rowAction = page.getByRole("button", { name: /(ni|:) sotish$/ }).first();
  await expect(rowAction).toBeVisible({ timeout: 60_000 });
  await rowAction.click();
  const dialog = page.getByRole("dialog", { name: "Sotish" });
  await expect(dialog).toBeVisible();
  return dialog;
};

/**
 * Bekor qilish sababi — dizayn v2 `Select` (combobox): ochiladi, variant bosiladi. Ro'yxat `#ui-portal` da
 * (oyna tashqarisida), shuning uchun variant sahifadan qidiriladi.
 */
export const chooseCancelReason = async (page: Page, dialog: Locator, label: string) => {
  await dialog.getByRole("combobox", { name: /^Sabab/ }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: /^Sabab/ })).toHaveText(label);
};
