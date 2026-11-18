import { type Page, type Route } from "@playwright/test";

/**
 * COURIER-SCAN (ega, 2026-11-17) — kuryer skani = QABUL, soxta backend (`POST /orders/scan-assign` yangi xulqi):
 * skan bilan olingan buyurtma darhol `waiting` va kuryerda (`courier_id`, `holder_type: COURIER`) — `on the road`
 * emas, alohida «Qabul qilish» (`PATCH post/receive/:id`) yo'q. Kuryer ro'yxati (`GET orders/courier/orders`) olingan
 * buyurtmani «Kutilayotgan» da ko'rsatadi; `POST orders/sell/:id` uni sotadi.
 * Faqat ruxsat etilgan yozuvlar (skan-olish va sotish) — qolgan har qanday yozish `leaked` ga tushadi (`PATCH
 * post/receive` ham — kuryer endi uni yubormaydi).
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

export const COURIER_ID = "31";
/** HQ → filial o'tkazma pochtasida yo'lda (menejer hali qabul qilmagan) — kuryer skani filialga ham qabul qiladi. */
export const TRANSFER_TOKEN = "c0c0c0c0c0c0c0c0c0c0c401";
/** Filial qabul qilgan, kuryersiz kutilmoqda. */
export const BRANCH_TOKEN = "c0c0c0c0c0c0c0c0c0c0c402";

type Seed = { id: string; name: string; status: string; courierId: string | null; postId: string };
const SEEDS: Record<string, Seed> = {
  [TRANSFER_TOKEN]: { id: "10401", name: "Dilnoza Karimova", status: "on_the_road", courierId: null, postId: "42" },
  [BRANCH_TOKEN]: { id: "10402", name: "Jasur Olimov", status: "waiting", courierId: null, postId: "42" },
};

export const mockCourierScanTakeApi = async (page: Page, theme: "light" | "dark" = "light") => {
  const state = new Map(Object.entries(SEEDS).map(([token, seed]) => [token, { ...seed }]));
  const tokenById = new Map(Object.entries(SEEDS).map(([token, seed]) => [seed.id, token]));
  const assigns: string[] = [];
  const sells: string[] = [];
  const leaked: string[] = [];

  const orderOf = (token: string) => {
    const seed = state.get(token) as Seed;
    return {
      id: seed.id,
      order_number: seed.id,
      status: seed.status,
      courier_id: seed.courierId,
      holder_type: seed.courierId ? "COURIER" : "BRANCH",
      holder_courier_id: seed.courierId,
      post_id: seed.postId,
      qr_code_token: token,
      where_deliver: "address",
      total_price: 185000,
      paid_amount: 0,
      to_be_paid: 185000,
      product_quantity: 1,
      created_at: "2026-11-17T08:00:00.000Z",
      createdAt: "2026-11-17T08:00:00.000Z",
      comment: null,
      address: "Bunyodkor ko'chasi, 12",
      customer: { id: `c-${seed.id}`, name: seed.name, phone_number: "+998901112233" },
      district: { id: "d1", name: "Chilonzor tumani", region: { id: "r1", name: "Toshkent shahri" } },
      region: { name: "Toshkent shahri" },
      market: { id: "m1", name: "Baraka Shop" },
      items: [{ id: `i-${seed.id}`, product_id: "p1", quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
    };
  };
  const mine = () =>
    [...state.entries()]
      .filter(([, seed]) => seed.courierId === COURIER_ID && seed.status === "waiting")
      .map(([token]) => orderOf(token));

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
        wrap({
          id: COURIER_ID,
          role: "courier",
          name: "Kuryer",
          status: "active",
          branch_id: "2",
          branch: { id: "2", name: "Chilonzor", type: "REGIONAL" },
          settings: { appearance: { theme, themeChosen: true } },
        }),
      );
    }
    const qr = /^orders\/qr-code\/([0-9a-f]{24})$/.exec(path);
    if (qr && state.has(qr[1])) return reply(route, wrap(orderOf(qr[1])));
    if (path === "orders/scan-assign" && request.method() === "POST") {
      const token = (request.postDataJSON() as { qr_token: string }).qr_token;
      assigns.push(token);
      const seed = state.get(token);
      if (!seed) return reply(route, { statusCode: 404, message: "Buyurtma topilmadi" }, 404);
      // Skan = qabul: darhol «kutilmoqda» va shu kuryerda (yo'ldagi o'tkazma ham — filialga qabul + berish).
      seed.status = "waiting";
      seed.courierId = COURIER_ID;
      seed.postId = "p-77";
      return reply(
        route,
        wrap({
          idempotent: false,
          order_id: seed.id,
          post_id: "p-77",
          post_created: assigns.length === 1,
          status: "waiting",
          order: { id: seed.id, order_number: seed.id, status: "waiting", customer: { name: seed.name }, district: "Chilonzor tumani" },
        }),
      );
    }
    if (path === "orders/courier/orders/counts") {
      return reply(route, wrap({ waiting: mine().length, all: mine().length, cancelled: 0 }));
    }
    if (path === "orders/courier/orders") {
      const rows = mine();
      return reply(route, { statusCode: 200, data: rows, total: rows.length, page: 1, limit: 10 });
    }
    const sell = /^orders\/sell\/(\d+)$/.exec(path);
    if (sell && request.method() === "POST") {
      sells.push(sell[1]);
      const seed = state.get(tokenById.get(sell[1]) as string);
      if (!seed || seed.status !== "waiting") {
        return reply(route, { statusCode: 400, message: "Buyurtma kutilmoqda (waiting) holatida emas" }, 400);
      }
      seed.status = "sold";
      return reply(route, { statusCode: 200, message: "Order sold", data: { id: sell[1], status: "sold" } });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
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
  return { assigns, sells, leaked };
};
