import { expect, type Page, type Route } from "@playwright/test";

/**
 * Dashboard qisman nosozligi (VkwhHqvW) — soxta backend. Kontrakt: FRONTEND_CHANGELOG 2026-10-12/14
 * (`GET /analytics/dashboard` → `degraded: true` + `failed_parts`; asosiy order ma'lumoti olinmasa 503).
 * Birinchi javob nosoz, «Qayta urinish» dan keyingisi — sog' (servis tiklandi). Serverga so'rov ketmaydi.
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

export type DegradedRole = "superadmin" | "admin" | "registrator" | "market" | "courier" | "manager";

const MARKETS = [
  { market_id: "m1", market_name: "Baraka Shop", total_orders: 45, successful_orders: 38, success_rate: 84.4 },
  { market_id: "m2", market_name: "Nur Elektronika", total_orders: 40, successful_orders: 30, success_rate: 75 },
];
const BRANCHES = [
  { branch_id: "b1", branch_name: "Toshkent HQ", total_orders: 209, successful_orders: 166, success_rate: 79.4 },
  { branch_id: "b6", branch_name: "Urgut filiali", total_orders: 86, successful_orders: 58, success_rate: 67.4 },
];
const COURIERS = [{ courier_id: "1", courier_name: "Jasur Tursunov", total_orders: 30, successful_orders: 26, success_rate: 86.7 }];

const healthy = (role: DegradedRole) => ({
  orders: { acceptedCount: 120, soldAndPaid: 80, cancelled: 10, profit: 1_200_000, totalRevenue: 9_600_000 },
  myStat: { totalOrders: 28, soldOrders: 19, canceledOrders: 3, profit: 480_000, successRate: 67.86 },
  markets: MARKETS,
  couriers: COURIERS,
  topMarkets: MARKETS,
  topBranches: BRANCHES,
  topCouriers: COURIERS,
  topOperators: [],
  topMarketsMeta: { period_rule: "last_30_days", period_days: 30, min_orders: 1 },
  topBranchesMeta: { period_rule: "last_30_days", period_days: 30, min_orders: 1 },
  ...(role === "manager"
    ? { branchDashboard: { role: "MANAGER", today_orders_count: 4, week_orders_count: 20, active_batches_count: 1, couriers_count: 3 } }
    : {}),
});

type Options = {
  role?: DegradedRole;
  /** Birinchi javobdagi olinmagan bo'laklar (javob kalitlari); qiymati `null` qilinadi — backend kabi. */
  failedParts?: string[];
  /** Birinchi javoblar 503 (asosiy order ma'lumoti olinmadi), «Qayta urinish» dan keyin — sog'. */
  unavailable?: boolean;
};

export const mockDegradedDashboard = async (page: Page, { role = "superadmin", failedParts = [], unavailable = false }: Options = {}) => {
  const leaked: string[] = [];
  let dashboardCalls = 0;
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
          name: "E2E",
          status: "active",
          ...(role === "manager" ? { branch_id: "b6", branch: { id: "b6", type: "REGIONAL", name: "Urgut filiali" } } : {}),
        },
      });
    }
    if (path === "analytics/dashboard") {
      dashboardCalls += 1;
      const first = dashboardCalls === 1;
      // 503: so'rov bir marta avtomatik qayta urinadi (QueryClient `retry: 1`) — ikkalasi ham nosoz.
      if (unavailable && dashboardCalls <= 2) {
        return reply(route, { statusCode: 503, message: "Dashboard ma'lumoti vaqtincha olinmadi" }, 503);
      }
      const data: Record<string, unknown> = healthy(role);
      if (first && failedParts.length) {
        for (const part of failedParts) data[part] = null;
        Object.assign(data, { degraded: true, failed_parts: failedParts });
      }
      return reply(route, { statusCode: 200, message: "ok", data });
    }
    if (path === "analytics/kpi") {
      return reply(route, {
        statusCode: 200,
        data: { averageOrderValue: 96_000, averageFulfillmentHours: 20, onTimeRate: 82, cancellationRate: 8, courierEfficiency: 0, marketRating: [] },
      });
    }
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, dashboardCalls: () => dashboardCalls };
};

export const openDashboard = async (page: Page, path = "/") => {
  await page.goto(path);
  await expect(page.locator("[data-shell-slot=content]")).toBeVisible({ timeout: 90_000 });
};
