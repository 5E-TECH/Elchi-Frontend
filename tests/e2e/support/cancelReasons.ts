import { type Page, type Route } from "@playwright/test";

/** «Bekor qilish sabablari» (GNWDKvmZ) uchun soxta backend: so'rovlar `stats` ga, yozuvchi so'rov `leaked` ga tushadi. */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const STATS = {
  total: 40,
  by_reason: [
    { reason: "CUSTOMER_NO_ANSWER", label: "Mijoz javob bermadi", count: 18 },
    { reason: "CUSTOMER_REFUSED", label: "Mijoz rad etdi", count: 12 },
    { reason: "PRICE_DISPUTE", label: "Narx bo'yicha kelishmovchilik", count: 6 },
    { reason: "UNKNOWN", label: "Noma'lum", count: 4 },
  ],
};

const LONG_LABEL = "Mijoz buyurtmani qabul qilishdan voz kechdi va qayta yetkazib berishni ham xohlamadi, sababini aytmadi";

export interface CancelReasonsOptions {
  role?: string;
  theme?: "light" | "dark";
  language?: "uz" | "ru" | "en";
  /** Backend hisoblagan oraliq (`applied_range`). */
  appliedRange?: { startDate: string; endDate: string };
  /** Tarjimasi yo'q, uzun yorliqli sabab va katta son — kenglik sinovi. */
  long?: boolean;
}

export const mockCancelReasons = async (page: Page, { role = "superadmin", theme = "light", language = "uz", appliedRange, long = false }: CancelReasonsOptions = {}) => {
  const leaked: string[] = [];
  const stats: URLSearchParams[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "1", role, name: "E2E", status: "active", settings: { appearance: { theme, themeChosen: true, language } } }));
    }
    if (path === "orders/cancel-reasons/stats") {
      stats.push(url.searchParams);
      // Market tanlanganda boshqa raqam: ekrandagi son filtrga ergashishi tekshiriladi.
      if (url.searchParams.has("market_id")) return reply(route, wrap({ total: 7, by_reason: [{ reason: "OTHER", label: "Boshqa", count: 7 }] }));
      const by_reason = long ? [...STATS.by_reason, { reason: "NEW_REASON", label: LONG_LABEL, count: 1_234_567 }] : STATS.by_reason;
      return reply(route, wrap({ ...STATS, by_reason, total: long ? 1_234_607 : STATS.total, ...(appliedRange ? { applied_range: appliedRange } : {}) }));
    }
    if (path === "branches") {
      return reply(route, wrap({ items: [{ id: 1, name: "HQ Toshkent" }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } }));
    }
    if (path === "markets" || path === "users/market") {
      return reply(route, wrap({ items: [{ id: 7, name: "Baraka Shop" }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } }));
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
  return { leaked, stats };
};
