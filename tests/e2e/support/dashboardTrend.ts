import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Bosh sahifa (superadmin) — soxta gateway: DwrMygfo (`previous` + 14 kunlik `series` dashboard va kpi javobida),
 * l9NNdsCH (`orders.lostRevenue`, `targets.successRate`, revenue `profit` / `totalProfit` / `profitValues`),
 * XdKajqLe (`all=true` — kpi va revenue ham, `clamped` + `effective_from` / `effective_to`). Kontrakt — backend
 * FRONTEND_CHANGELOG 2026-10-24 (batch D). Yozish so'rovlari taqiqlangan; serverga hech narsa chiqmaydi.
 * Ilova manzili — `playwright.config.ts` `baseURL` (worktree probe'larida boshqa port).
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const last14 = (to: string) => Array.from({ length: 14 }, (_, index) => iso(Date.parse(`${to}T00:00:00Z`) - (13 - index) * DAY));

export const ALL_TIME_META = { clamped: true, effective_from: "2025-10-27", effective_to: todayIso(), max_span_days: 366 };

const orders = { acceptedCount: 312, soldAndPaid: 241, cancelled: 25, totalRevenue: 48_600_000, profit: 4_900_000, lostRevenue: 5_000_000 };

const dashboardData = (params: URLSearchParams) => {
  const all = params.get("all") === "true";
  const to = params.get("end_day") || todayIso();
  return {
    orders,
    markets: [],
    couriers: [{ courier_id: "7", courier_name: "Jasur Tursunov", total_orders: 30, successful_orders: 26, success_rate: 86.7 }],
    topMarkets: [],
    topBranches: [],
    topCouriers: [],
    topOperators: [],
    targets: { successRate: 80 },
    // «Barchasi»da oldingi davr yo'q (backend), seriya — oyna oxiri bilan tugaydigan 14 kun.
    previous: all
      ? null
      : { from: null, to: null, acceptedCount: 300, soldAndPaid: 224, cancelled: 28, totalRevenue: 45_680_000, profit: 4_184_000, lostRevenue: 5_600_000 },
    series: last14(all ? ALL_TIME_META.effective_to : to).map((date, index) => ({
      date,
      acceptedCount: 280 + index * 2,
      soldAndPaid: 200 + index * 3,
      cancelled: 20 + (index % 4),
      totalRevenue: 39_500_000 + index * 700_000,
      profit: 3_900_000 + index * 70_000,
      lostRevenue: 6_000_000 - index * 70_000,
    })),
    degraded: false,
    failed_parts: [],
    ...(all ? ALL_TIME_META : {}),
  };
};

const kpiData = (params: URLSearchParams) => {
  const all = params.get("all") === "true";
  const to = params.get("end_day") || todayIso();
  return {
    averageOrderValue: 201_700,
    averageFulfillmentHours: 5.6667,
    onTimeRate: 86.4,
    deliveryCount: 241,
    cancellationRate: 8,
    courierEfficiency: 3,
    marketRating: [],
    previous: all ? null : { from: null, to: null, averageOrderValue: 198_300, averageFulfillmentHours: 6, onTimeRate: 84, deliveryCount: 224, cancellationRate: 9.3 },
    series: last14(all ? ALL_TIME_META.effective_to : to).map((date, index) => ({
      date,
      averageOrderValue: 190_000 + index * 900,
      averageFulfillmentHours: 6,
      onTimeRate: 85,
      deliveryCount: 200,
      cancellationRate: 8,
    })),
    degraded: false,
    failed_parts: [],
    ...(all ? ALL_TIME_META : {}),
  };
};

const revenueData = (params: URLSearchParams) => {
  const all = params.get("all") === "true";
  const labels = all ? ["11.2025", "12.2025", "01.2026"] : ["01.10", "02.10", "03.10"];
  const revenue = [9_000_000, 12_000_000, 10_500_000];
  const profit = [900_000, 1_250_000, 1_050_000];
  return {
    data: labels.map((label, index) => ({ period: label, label, ordersCount: 50 + index, revenue: revenue[index], profit: profit[index] })),
    summary: { totalRevenue: 31_500_000, totalOrders: 153, avgRevenue: 10_500_000, totalProfit: 3_200_000 },
    chart: { labels, values: revenue, profitValues: profit },
    finance: {
      currentSituation: 22_543_000,
      main: { balance: 24_615_000 },
      markets: { marketsTotalBalans: 13_458_000 },
      branches: { branchReceivable: 11_386_000 },
      couriers: { couriersTotalBalanse: 0 },
    },
    degraded: false,
    failed_parts: [],
    ...(all ? ALL_TIME_META : {}),
  };
};

export interface DashboardRequests {
  dashboard: URLSearchParams[];
  kpi: URLSearchParams[];
  revenue: URLSearchParams[];
  leaked: string[];
}

export const openDashboard = async (page: Page, { theme = "light" }: { theme?: "light" | "dark" } = {}) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, data: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ statusCode: 200, message: "ok", data }) });
  const requests: DashboardRequests = { dashboard: [], kpi: [], revenue: [], leaked: [] };

  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") requests.leaked.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(route, {
        id: "1",
        role: "superadmin",
        name: "E2E",
        status: "active",
        settings: { appearance: { theme, themeChosen: true, language: "uz" } },
      });
    }
    if (path === "analytics/dashboard") {
      requests.dashboard.push(url.searchParams);
      return reply(route, dashboardData(url.searchParams));
    }
    if (path === "analytics/kpi") {
      requests.kpi.push(url.searchParams);
      return reply(route, kpiData(url.searchParams));
    }
    if (path === "analytics/revenue") {
      requests.revenue.push(url.searchParams);
      return reply(route, revenueData(url.searchParams));
    }
    return reply(route, []);
  });
  await page.addInitScript((themeName) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("app-language", "uz");
    window.localStorage.setItem("theme", themeName);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  await page.goto("/");
  const kpis = page.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
  await expect(kpis).toBeVisible({ timeout: 90_000 });
  return { kpis, requests };
};

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
