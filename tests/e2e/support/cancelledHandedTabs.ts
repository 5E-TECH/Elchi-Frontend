import { test, type Page, type Route } from "@playwright/test";

/**
 * «Qabul va yaratish → Bekor qilinganlar» ichki tablari (2026-11-10): «Kutilmoqda» (`GET /orders/markets/cancelled`) va
 * «Topshirilgan» (`GET /orders/markets/cancelled/handovers`, `…/handovers/:batchId`) uchun soxta gateway (superadmin).
 * Kontrakt — backend FRONTEND_CHANGELOG 2026-11-10. Yozish so'rovlari taqiqlangan (`leaked`). Ilova manzili — `baseURL`.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;

/**
 * Qotirilgan soat — Toshkentda 2026-11-10 12:00 (brauzerda ham `page.clock.setFixedTime`): «Bugun» / «Kecha» guruhlari
 * yarim tunda (00:00–00:30) siljimaydi, sukut oy (`start_day`) — noyabr.
 */
export const NOW = Date.parse("2026-11-10T07:00:00Z");
const tashkentDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date(ms));

export const TODAY = tashkentDay(NOW);

const MARKETS = [
  ["201", "Baraka Shop", "+998901234567", 12, 3_480_000],
  ["202", "Nur Market", "+998935557788", 7, 1_965_000],
].map(([id, name, phone, count, sum]) => ({
  market_id: id,
  orders_count: count,
  total_price_sum: sum,
  market: { id, name, phone_number: phone },
}));

const batch = (
  marketId: string,
  name: string,
  minutesAgo: number,
  orders: number,
  sum: number,
  method: string | null,
  manual: number,
  staff: string | null,
) => {
  const at = NOW - minutesAgo * 60_000;
  return {
    id: `${marketId}_${at}000_${staff ? 520 : 0}`,
    market_id: marketId,
    market: { id: marketId, name, phone_number: "+998901234567" },
    handed_at: new Date(at).toISOString(),
    day: tashkentDay(at),
    handed_by: staff ? { id: "520", name: staff } : null,
    method,
    manual_count: manual,
    orders_count: orders,
    total_price_sum: sum,
  };
};

export const BATCHES = [
  batch("201", "Baraka Shop", 5, 6, 1_740_000, "qr", 1, "Aziz Karimov"),
  batch("202", "Nur Market", 60 * 24 + 30, 4, 1_120_000, "pin", 0, "Malika Rasulova"),
];

const ORDERS = [
  ["10235", "Malika Yusupova", 96_000],
  ["10220", "Dilfuza Hasanova", 245_000],
].map(([id, name, total]) => ({
  id,
  status: "returned_to_market",
  where_deliver: "center",
  total_price: total,
  createdAt: "2026-11-08T08:00:00.000Z",
  items: [{ id: `i-${id}`, quantity: 1, product: { id: "p1", name: "Qishki shapka" } }],
  customer: { id: `c-${id}`, name, phone_number: "+998901112233" },
  district: { id: "d1", name: "Sergeli tumani", region: { id: "r1", name: "Toshkent sh." } },
}));

export const openCancelledTabs = async (page: Page) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });
  const requests = { handovers: [] as URLSearchParams[], batches: [] as string[], leaked: [] as string[] };

  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap({ id: "1", role: "superadmin", name: "E2E", status: "active" }));
    if (request.method() !== "GET") {
      requests.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "orders/markets/cancelled") return reply(route, wrap(MARKETS));
    if (path === "orders/markets/cancelled/handovers") {
      requests.handovers.push(url.searchParams);
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const items = BATCHES.filter((item) => !search || item.market.name.toLowerCase().includes(search));
      return reply(route, {
        data: items,
        total: items.length,
        page: 1,
        limit: Number(url.searchParams.get("limit") ?? 24),
        totals: {
          batches: items.length,
          orders: items.reduce((sum, item) => sum + item.orders_count, 0),
          amount: items.reduce((sum, item) => sum + item.total_price_sum, 0),
        },
        total_pages: 1,
      });
    }
    const one = /^orders\/markets\/cancelled\/handovers\/(.+)$/.exec(path);
    if (one) {
      const id = decodeURIComponent(one[1]);
      requests.batches.push(id);
      const found = BATCHES.find((item) => item.id === id);
      return found
        ? reply(route, { batch: found, data: ORDERS, total: ORDERS.length })
        : reply(route, { statusCode: 404, message: "Topshirish topilmadi" }, 404);
    }
    return reply(route, wrap([]));
  });
  // Brauzer soati fixture bilan bir: `new Date()` / `Date.now()` qotiriladi, taymerlar (qidiruv kechikishi) yuradi.
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return requests;
};
