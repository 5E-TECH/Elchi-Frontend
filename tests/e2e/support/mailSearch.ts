import { expect, type Page, type Route } from "@playwright/test";

/**
 * Pochta tafsiloti → qidiruv (`?q=`) va takroriy telefonlar (MD-1) — soxta backend.
 * Pochta №2483 (Qashqadaryo, maket `superadmin-mails-detail-duplicates`): 9 buyurtma, 2 ta takroriy raqam.
 * `role: "manager"` — filial menejeri (REGIONAL), pochta `sent`, buyurtmalar yo'lda (`manager-mails-detail-receive-*`).
 * Faqat GET; yozish so'rovi bo'lsa `leaked` ga tushadi.
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const ROWS: Array<[string, string, string, string, string, "address" | "center", number]> = [
  ["10212", "Shoxrux Rahmonov", "+998914521830", "Qarshi sh.", "Baraka Shop", "address", 185000],
  ["10209", "Mohira Ergasheva", "+998937180462", "Shahrisabz tumani", "Nur Elektronika", "center", 240000],
  ["10207", "Laylo Hasanova", "+998902335179", "Kitob tumani", "Chilonzor Market", "address", 96000],
  ["10204", "Bekzod Murodov", "+998976401285", "G'uzor tumani", "Ipak Yo'li Savdo", "address", 312000],
  ["10201", "Gulshan Tursunova", "+998993056614", "Koson tumani", "Baraka Shop", "center", 150000],
  ["10199", "Sanjar Qurbonov", "+998948112703", "Qarshi sh.", "Nur Elektronika", "address", 128000],
  ["10195", "Nigora Xoliqova", "+998884023951", "Yakkabog' tumani", "Chilonzor Market", "center", 205000],
  ["10192", "Laylo Hasanova", "902335179", "Kitob tumani", "Baraka Shop", "address", 84000],
  ["10188", "Zarina Usmonova", "+998 93 718 04 62", "Muborak tumani", "Ipak Yo'li Savdo", "center", 130000],
];

const order = ([id, name, phone, district, market, whereDeliver, price]: (typeof ROWS)[number], status: string) => ({
  id,
  createdAt: "2026-10-15T08:00:00.000Z",
  updatedAt: "2026-10-15T08:00:00.000Z",
  market_id: `m-${market}`,
  customer_id: `c${id}`,
  product_quantity: 1,
  where_deliver: whereDeliver,
  total_price: price,
  to_be_paid: price,
  paid_amount: 0,
  status,
  comment: null,
  operator: null,
  address: "Mustaqillik ko'chasi, 21",
  customer: { id: `c${id}`, name, phone_number: phone },
  market: { id: `m-${market}`, name: market },
  district: { id: `d-${district}`, name: district, region_id: "14", region: { id: "14", name: "Qashqadaryo" } },
  region: { id: "14", name: "Qashqadaryo" },
  items: [],
});

export const mockMailSearchApi = async (
  page: Page,
  {
    role = "superadmin" as "superadmin" | "manager",
    theme = "light" as "light" | "dark",
    /** TOZ-0 (mSix70Ca c2b54a): katta pochta — 9 ta asosiy qatordan keyin shuncha noyob qator (har biri o'z raqami bilan). */
    extraRows = 0,
  } = {},
) => {
  const isManager = role === "manager";
  const markets = ["Baraka Shop", "Nur Elektronika", "Chilonzor Market", "Ipak Yo'li Savdo"];
  const districts = ["Qarshi sh.", "Shahrisabz tumani", "Kitob tumani", "G'uzor tumani", "Koson tumani"];
  const extra = Array.from({ length: extraRows }, (_, index): (typeof ROWS)[number] => [
    String(20000 + index),
    `Mijoz ${String(index + 1).padStart(3, "0")}`,
    `+99895${String(4000000 + index).padStart(7, "0")}`,
    districts[index % districts.length],
    markets[index % markets.length],
    index % 2 ? "center" : "address",
    100000 + index * 1000,
  ]);
  const orders = [...ROWS, ...extra].map((row) => order(row, isManager ? "on the road" : "received"));
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
          id: "1",
          role,
          name: isManager ? "Qarshi menejeri" : "Bosh admin",
          status: "active",
          ...(isManager ? { branch: { id: "3", name: "Qarshi filiali", type: "REGIONAL" }, branch_id: "3" } : {}),
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "post/orders/2483") {
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          allOrdersByPostId: orders,
          homeOrders: { homeOrders: 0, homeOrdersTotalPrice: 0 },
          centerOrders: { centerOrders: 0, centerOrdersTotalPrice: 0 },
          post: {
            id: "2483",
            status: isManager ? "sent" : "new",
            region_id: "14",
            region: { id: "14", name: "Qashqadaryo" },
            qr_code_token: "qr-post-2483",
            order_quantity: orders.length,
            createdAt: "2026-10-16T08:00:00.000Z",
          },
        },
      });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
    window.localStorage.setItem("theme-version", "2");
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  }, theme);
  return { orders, leaked };
};

export const openMailSearch = async (page: Page, query = "") => {
  await page.goto(`/mails/2483${query}`);
  await expect(page.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" })).toBeVisible({ timeout: 60_000 });
};
