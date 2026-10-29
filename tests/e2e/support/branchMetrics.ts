import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * 6CYRjoZG — `/branches/:id` «Filial ko'rsatkichlari» uchun soxta gateway (superadmin). Kontrakt: backend
 * FRONTEND_CHANGELOG 2026-10-24 (batch D) — `GET /analytics/dashboard?branch_id=` javobiga `branch_id`,
 * `dailyRevenue`, `statusDistribution`, `topCouriers` + `topCouriersMeta`, `branchDashboard`, `previous`, `series`.
 * Kunlik daromad bandlari va 14 kunlik seriya so'ralgan sanalardan quriladi (testlar har kuni o'tadi).
 * Yozish so'rovlari taqiqlangan; serverga hech narsa chiqmaydi. Ilova manzili — `playwright.config.ts` `baseURL`.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const METRICS_BRANCH = {
  id: "15",
  name: "Urgut filiali",
  code: "SMQ-URG",
  type: "HYBRID",
  status: "active",
  level: 2,
  parent_id: "7",
  parent: { id: "7", name: "Samarqand filiali" },
  region: { id: "12", name: "Samarqand viloyati" },
  district: { id: "121", name: "Urgut tumani" },
  address: "Bozor ko'chasi, 14",
  employees_count: 5,
  created_at: "2025-07-09T12:00:00.000Z",
};

const EMPLOYEES = [
  { id: 1, user_id: 208, role: "MANAGER", createdAt: "2025-07-09T12:00:00.000Z", user: { id: 208, name: "Ravshan Ortiqov", phone_number: "+998915123407" } },
  { id: 2, user_id: 210, role: "REGISTRATOR", createdAt: "2025-07-10T12:00:00.000Z", user: { id: 210, name: "Madina Sobirova", phone_number: "+998937182045" } },
  { id: 3, user_id: 209, role: "COURIER", createdAt: "2025-07-12T12:00:00.000Z", user: { id: 209, name: "Bahodir Karimov", phone_number: "+998975142683" } },
];

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayLabel = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
/** Dam olish kunlari daromad tushadi (maketdagi to'lqin). */
const revenueOf = (day: string) => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const base = weekday === 0 ? 3_095_000 : weekday === 6 ? 5_296_000 : 6_100_000;
  return base + (Number(day.slice(8, 10)) % 5) * 211_000;
};

const daysBetween = (from: string, to: string) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Array.from({ length: Math.round((end - start) / DAY) + 1 }, (_, index) => iso(start + index * DAY));
};

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Sog' javob (maketdagi «Urgut filiali, bu hafta» raqamlari). */
export const healthyMetrics = (params: URLSearchParams) => {
  const to = params.get("end_day") || todayIso();
  const all = params.get("all") === "true";
  const from = all ? iso(Date.parse(`${to}T00:00:00Z`) - 29 * DAY) : params.get("start_day") || to;
  const seriesDays = daysBetween(iso(Date.parse(`${to}T00:00:00Z`) - 13 * DAY), to);
  return {
    branch_id: params.get("branch_id"),
    orders: { acceptedCount: 186, soldAndPaid: 141, cancelled: 17, totalRevenue: 26_400_000, profit: 2_900_000, lostRevenue: 1_310_000 },
    previous: all
      ? null
      : {
          // Oldingi teng oyna (joriydan oldingi shuncha kun).
          from: `${iso(2 * Date.parse(`${from}T00:00:00Z`) - Date.parse(`${to}T00:00:00Z`) - DAY)}T00:00:00.000Z`,
          to: `${iso(Date.parse(`${from}T00:00:00Z`) - DAY)}T00:00:00.000Z`,
          acceptedCount: 179,
          soldAndPaid: 129,
          cancelled: 15,
          totalRevenue: 24_420_000,
          profit: 2_675_000,
          lostRevenue: 1_100_000,
        },
    series: seriesDays.map((day, index) => ({
      date: day,
      acceptedCount: 22 + ((index * 7) % 26),
      soldAndPaid: 17 + ((index * 5) % 20),
      cancelled: 1 + (index % 3),
      totalRevenue: revenueOf(day),
      profit: Math.round(revenueOf(day) * 0.11),
      lostRevenue: 0,
    })),
    dailyRevenue: {
      data: daysBetween(from, to).map((day) => ({
        period: day,
        label: dayLabel(day),
        ordersCount: Math.round(revenueOf(day) / 180_000),
        revenue: revenueOf(day),
        profit: Math.round(revenueOf(day) * 0.11),
      })),
      summary: { totalRevenue: 26_400_000, totalOrders: 141, avgRevenue: 6_600_000, totalProfit: 2_900_000 },
    },
    statusDistribution: {
      distribution: {
        created: 0, new: 6, received: 0, "on the road": 19, waiting: 3, waiting_customer: 0,
        sold: 118, paid: 21, partly_paid: 2, cancelled: 15, "cancelled (sent)": 1, returned_to_market: 1, closed: 0,
      },
      total: 186,
    },
    topCouriers: [
      { courier_id: "209", courier_name: "Bahodir Karimov", total_orders: 71, successful_orders: 58, success_rate: 81.7 },
      { courier_id: "211", courier_name: "Sherzod Qurbonov", total_orders: 63, successful_orders: 49, success_rate: 77.8 },
      { courier_id: "212", courier_name: "Akmal Usmonov", total_orders: 46, successful_orders: 34, success_rate: 73.9 },
    ],
    topCouriersMeta: { period_rule: "selected_range", period_days: null, from, to, min_orders: 5, filtered_out: 0 },
    branchDashboard: { role: "SUPER", stats_unavailable: false, cards: { couriers: { branch_couriers: 3, active_today: 3 } } },
    targets: { successRate: 80 },
    degraded: false,
    failed_parts: [],
  };
};

type DashboardResponder = (params: URLSearchParams, call: number) => { status: number; data?: unknown; message?: string };

export const mockBranchMetricsApi = async (
  page: Page,
  { theme = "light", dashboard }: { theme?: "light" | "dark"; dashboard?: DashboardResponder } = {},
) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const leaked: string[] = [];
  const dashboardRequests: URLSearchParams[] = [];

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "auth/my-profile") {
      // Mavzu serverdagi `appearance.theme` dan sinxronlanadi (SettingsSync).
      return reply(
        route,
        wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active", settings: { appearance: { theme, themeChosen: true } } }),
      );
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === `branches/${METRICS_BRANCH.id}`) return reply(route, wrap(METRICS_BRANCH));
    if (path === `branches/${METRICS_BRANCH.id}/users`) return reply(route, wrap(EMPLOYEES));
    if (path === "analytics/dashboard") {
      dashboardRequests.push(url.searchParams);
      const result = dashboard?.(url.searchParams, dashboardRequests.length) ?? { status: 200, data: healthyMetrics(url.searchParams) };
      if (result.status !== 200) return reply(route, { statusCode: result.status, message: result.message ?? "e2e" }, result.status);
      return reply(route, { statusCode: 200, message: "Dashboard infos", data: result.data });
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });

  await page.addInitScript((themeName) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", themeName);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return { leaked, dashboardRequests };
};

/** Filial sahifasi → «Filial ko'rsatkichlari» KPI'lari chizilguncha. */
export const openBranchMetrics = async (page: Page, search = "") => {
  await page.goto(`/branches/${METRICS_BRANCH.id}${search}`);
  await expect(page.getByRole("heading", { level: 1, name: METRICS_BRANCH.name })).toBeVisible({ timeout: 90_000 });
  const section = page.getByRole("region", { name: "Filial ko'rsatkichlari" });
  await expect(section).toBeVisible({ timeout: 30_000 });
  return section;
};

/** Skrinshot (faqat `BRANCH_METRICS_SHOTS=<papka>` berilganda): butun sahifa ko'rinadigan baland oynada. */
export const shotBranchMetrics = async (page: Page, name: string, height: number) => {
  const dir = process.env.BRANCH_METRICS_SHOTS;
  if (!dir) return;
  const viewport = page.viewportSize();
  if (!viewport) return;
  await page.setViewportSize({ width: viewport.width, height });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png` });
  await page.setViewportSize(viewport);
};
