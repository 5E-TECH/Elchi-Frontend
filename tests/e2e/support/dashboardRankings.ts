import { expect, type Page, type Route } from "@playwright/test";

/**
 * Dashboard reytinglari (9zbSDkUI) — soxta backend.
 * Backend kabi: bir kunlik davrda (Bugun) reyting oxirgi 30 kun bo'yicha (`period_rule: last_30_days`),
 * 2+ kunlik davrda tanlangan oraliq (`selected_range`, `from` / `to`). Serverga so'rov ketmaydi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const MARKET_NAMES = [
  "Baraka Shop",
  "Nur Elektronika",
  "Ipak Yo'li Savdo",
  "Chilonzor Market",
  "Oila Market",
  "Samarqand Savdo",
  "Buxoro Bozor",
  "Toshkent Moda",
];
export const MARKETS = MARKET_NAMES.map((name, i) => ({
  market_id: `m${i + 1}`,
  market_name: name,
  total_orders: 45 - i,
  successful_orders: 38 - i * 2,
  success_rate: ((38 - i * 2) / (45 - i)) * 100,
}));

export const BRANCHES = (
  [
    ["b1", "Toshkent HQ", 209, 166],
    ["b2", "Samarqand filiali", 34, 25],
    ["b3", "Andijon filiali", 22, 16],
    ["b4", "Farg'ona filiali", 29, 21],
    ["b5", "Buxoro filiali", 18, 13],
    ["b6", "Urgut filiali", 86, 58],
  ] as const
).map(([id, name, total, sold]) => ({
  branch_id: id,
  branch_name: name,
  total_orders: total,
  successful_orders: sold,
  success_rate: (sold / total) * 100,
}));

type Options = {
  role?: "superadmin" | "manager";
  topMarkets?: unknown[];
  topBranches?: unknown[];
};

export const mockRankingsApi = async (page: Page, { role = "superadmin", topMarkets = MARKETS, topBranches = [] }: Options = {}) => {
  const leaked: string[] = [];
  const dashboardParams: Array<Record<string, string>> = [];
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
      const params = Object.fromEntries(url.searchParams);
      dashboardParams.push(params);
      // «Barchasi» — `all=true` (tya24blo): backend oraliqni oxirgi 366 kunga qisqartiradi va reytingni shu
      // oraliq bo'yicha beradi (`selected_range`, `from` — qisqartirilgan boshlanish, 1970 emas).
      const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
      const all = params.all === "true";
      const startDay = all
        ? new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10)
        : params.start_day;
      const endDay = all ? today : params.end_day;
      const oneDay = !startDay || startDay === endDay;
      const meta = oneDay
        ? { period_rule: "last_30_days", period_days: 30, min_orders: 1 }
        : {
            period_rule: "selected_range",
            period_days: null,
            // Toshkent vaqti (UTC+5): kun boshi / oxiri.
            from: `${startDay}T00:00:00.000+05:00`,
            to: `${endDay}T23:59:59.999+05:00`,
            min_orders: 1,
          };
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          orders: { acceptedCount: 120, soldAndPaid: 80, cancelled: 10 },
          topMarkets,
          topBranches,
          topMarketsMeta: meta,
          topBranchesMeta: meta,
          ...(role === "manager"
            ? { branchDashboard: { role: "MANAGER", today_orders_count: 4, week_orders_count: 20, active_batches_count: 1, couriers_count: 3 } }
            : {}),
        },
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
  return { leaked, dashboardParams };
};

export const rankingCard = (page: Page, id: "markets" | "branches") => page.getByTestId(`ranking-${id}`);

export const openDashboard = async (page: Page, path = "/") => {
  await page.goto(path);
  await expect(page.locator('[data-testid^="ranking-"]').first()).toBeVisible({ timeout: 90_000 });
};

/** «12.10 – 15.10.2026» (bir yil) — `formatRangeShort` kabi. */
export const shortRange = (from: string, to: string) => {
  const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  if (from === to) return day(from);
  const start = from.slice(0, 4) === to.slice(0, 4) ? day(from).slice(0, 5) : day(from);
  return `${start} – ${day(to)}`;
};
