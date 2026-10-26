import type { Page, Route } from "@playwright/test";

/**
 * GaBIPi3Z / vbu7Wr3o — «Buyurtmalar» (`/orders`) soxta backendi: `GET orders` (ro'yxat), `GET orders/status-counts`
 * (holat tablari sonlari + `new_incoming`, so'rov parametrlari yoziladi), kuryerda `orders/courier/orders{,/counts}`.
 * Boshqa GET — bo'sh (`data: []`), yozish so'rovi — `leaked` (403).
 */
// Worktree serverlari boshqa portda — `E2E_ORIGIN`.
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

export const STATUS_COUNTS = {
  all: 1248,
  new: 32,
  received: 120,
  on_the_road: 86,
  waiting: 14,
  sold: 734,
  paid: 168,
  cancelled: 0,
  new_incoming: 7,
  by_status: {},
  search_truncated: false,
};

const order = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  qr_code_token: `tok-${id}`,
  createdAt: "2026-10-26T08:00:00.000Z",
  created_at: "2026-10-26T08:00:00.000Z",
  status: "waiting",
  total_price: 45000,
  to_be_paid: 0,
  paid_amount: 0,
  where_deliver: "center",
  product_quantity: 1,
  post_id: "35",
  holder_type: "BRANCH",
  holder_branch_id: "12",
  holder_courier_id: null,
  courier_id: null,
  market: { id: "37", name: "TEST market" },
  customer: { name, phone_number: "+998907421836" },
  district: { name: "Termiz tumani", region: { name: "Surxondaryo" } },
  region: { name: "Surxondaryo" },
  items: [],
  ...over,
});

export const PROFILES = {
  admin: { id: "1", role: "admin", name: "TEST Admin", status: "active", region_id: null },
  market: { id: "37", role: "market", name: "TEST market", status: "active" },
  courier: { id: "26", role: "courier", name: "TEST Kuryer", status: "active" },
  manager: {
    id: "25",
    role: "manager",
    name: "TEST Menejer",
    status: "active",
    branch_id: "12",
    branch: { id: "12", name: "TEST Claude Surxondaryo filiali", type: "HYBRID" },
    branch_type: "HYBRID",
    can_sell_cancel: true,
  },
} as const;

export const mockStatusCountsApi = async (
  page: Page,
  role: keyof typeof PROFILES = "admin",
  { theme = "light" }: { theme?: "light" | "dark" } = {},
) => {
  const state = {
    counts: STATUS_COUNTS as Record<string, unknown>,
    /** `GET orders/status-counts` so'rovlarining query parametrlari (tartib bilan). */
    countQueries: [] as Record<string, string>[],
    listQueries: [] as Record<string, string>[],
    requests: [] as string[],
    orders: [
      // Order 133 (prod E2E): 45 000, markazgacha, market tarifi 20 000 → backend chegarasi 25 000.
      order("133", "Sevara Tursunova", { sale_market_paid_max: 25000 }),
      order("134", "Dilnoza Karimova", { status: "new" }),
    ],
  };
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    state.requests.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: { ...PROFILES[role], settings: { appearance: { theme, themeChosen: true, language: "uz" } } },
      });
    }
    if (request.method() === "GET" && path === "orders/status-counts") {
      state.countQueries.push(Object.fromEntries(url.searchParams));
      return reply(route, { statusCode: 200, data: state.counts });
    }
    if (request.method() === "GET" && path === "orders") {
      state.listQueries.push(Object.fromEntries(url.searchParams));
      return reply(route, {
        statusCode: 200,
        data: state.orders,
        meta: { page: 1, limit: 10, total: STATUS_COUNTS.all, totalPages: 125 },
        total: STATUS_COUNTS.all,
      });
    }
    if (request.method() === "GET" && path === "orders/courier/orders/counts") {
      return reply(route, { statusCode: 200, data: { waiting: 4, all: 40, cancelled: 9 } });
    }
    if (request.method() === "GET" && path === "orders/courier/orders") {
      return reply(route, { statusCode: 200, data: { data: [], total: 4, page: 1, limit: 10 } });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((theme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", theme);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return { state, leaked };
};
