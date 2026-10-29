import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { CATALOG, LOGS } from "./activityLogs";

/**
 * Kontrast auditi sahifalari (OpzLWcqJ): `/`, `/orders`, `/orders/edit/:id`, `/new-orders/create`, `/payments`,
 * `/all-users`, `/settings` (har bo'lim), `/regions` (viloyat oynasi ochiq), `/activity-logs`. Ma'lumot — «Visual»
 * fixture'lari (`tests/visual/fixtures`, sintetik) va faollik jurnali yordamchisi; soxta backend, yozish taqiqlangan.
 * Mavzu serverdagi `appearance.theme` dan sinxronlanadi (SettingsSync) — profil shu mavzu bilan qaytadi.
 */
export type Theme = "light" | "dark";
type Role = "superadmin" | "admin" | "registrator";

/** Yo'l (bosh `/` siz) → to'liq javob tanasi (`{ statusCode, data }`). */
type Api = Record<string, unknown>;

export interface ContrastPage {
  path: string;
  role: Role;
  api: Api;
  /** Sahifa ma'lumoti chizilganining belgisi. */
  ready: (page: Page) => Promise<void>;
  /** Sukut — bitta o'lchov; bir nechta holat (tablar, oyna) bo'lsa — har biridan keyin `check()`. */
  run?: (page: Page, check: (options?: { minElements?: number }) => Promise<void>) => Promise<void>;
}

const fixture = (path: string) => JSON.parse(readFileSync(resolve("tests/visual/fixtures", path), "utf8"));
const empty = { statusCode: 200, data: [] };

const PERSONA: Record<Role, { id: string; name: string }> = {
  superadmin: { id: "1", name: "Aliyev Vali" },
  admin: { id: "2", name: "Karimova Dilnoza" },
  registrator: { id: "4", name: "Toshpo'latova Madina" },
};

const profile = (role: Role, theme: Theme) => ({
  statusCode: 200,
  data: {
    ...PERSONA[role],
    role,
    status: "active",
    settings: { appearance: { theme, themeChosen: true, language: "uz" } },
    ...(role === "registrator"
      ? { branch_id: "11", branch_type: "HQ", branch: { id: "11", name: "Toshkent HQ", type: "HQ", branch_type: "HQ" } }
      : {}),
  },
});

const DASHBOARD = fixture("dashboard/superadmin.json");
const REGIONS = fixture("regions/stats-all.json");

/** `GET region/stats/1` — viloyat oynasi: tumanlar va kuryerlar (sintetik). */
const REGION_DETAIL = {
  statusCode: 200,
  data: {
    id: "1",
    name: "Toshkent shahri",
    summary: { totalOrders: 112, totalDelivered: 91, totalCancelled: 8, pendingOrders: 13, totalRevenue: 18_516_000, activeCouriers: 22 },
    districts: [
      ["101", "Chilonzor tumani", 34, 29, 2, 3, 5],
      ["102", "Yunusobod tumani", 28, 22, 3, 3, 4],
      ["103", "Mirzo Ulug'bek tumani", 21, 17, 1, 3, 3],
      ["104", "Sergeli tumani", 0, 0, 0, 0, 0],
    ].map(([id, name, totalOrders, deliveredOrders, cancelledOrders, pendingOrders, activeCouriers]) => ({
      id,
      name,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      successRate: Number(totalOrders) ? Math.round((Number(deliveredOrders) / Number(totalOrders)) * 100) : 0,
      revenue: Number(deliveredOrders) * 185_000,
      activeCouriers,
    })),
    couriers: [
      { id: "93", name: "Rustam Qosimov", totalOrders: 40, deliveredOrders: 35, cancelledOrders: 2, successRate: 87.5, isPrimary: true, status: "active" },
      { id: "94", name: "Sardor Aliyev", totalOrders: 31, deliveredOrders: 24, cancelledOrders: 3, successRate: 77.4, status: "active" },
    ],
  },
};

const heading = (page: Page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 90_000 });

export const CONTRAST_PAGES: ContrastPage[] = [
  {
    path: "/",
    role: "superadmin",
    api: {
      "analytics/dashboard": DASHBOARD.dashboard.current,
      "analytics/kpi": DASHBOARD.kpi.current,
      "analytics/revenue": DASHBOARD.revenue.current,
      "region/stats/all": REGIONS,
    },
    ready: async (page) => {
      await heading(page);
      await expect(page.locator('[data-testid^="ranking-"]').first()).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    path: "/orders",
    role: "superadmin",
    api: { orders: fixture("orders/orders.json"), markets: fixture("orders/markets.json") },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByText("Aliyev Vali").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    path: "/orders/edit/96",
    role: "admin",
    api: {
      "orders/96": fixture("order-detail/order-96.json"),
      "orders/96/tracking": fixture("order-detail/tracking.json"),
      "users/93": { statusCode: 200, data: { id: "93", name: "Rustam Qosimov", phone_number: "+998970000090", role: "courier" } },
    },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByText("Dilnoza Karimova").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    path: "/new-orders/create",
    role: "registrator",
    api: {
      "orders/ai-availability": { statusCode: 200, data: { enabled: true, state: "enabled" } },
      markets: fixture("order-create/markets.json"),
      "orders/markets/31/new": fixture("order-create/market-orders.json"),
    },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByRole("button", { name: /Market tanlash/ })).toBeVisible({ timeout: 60_000 });
    },
    // Bo'sh forma va market tanlash oynasi, so'ng tanlangan market bilan 1-qadam.
    run: async (page, check) => {
      await check();
      await page.getByRole("button", { name: /Market tanlash/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("option", { name: /Baraka Shop/ })).toBeVisible();
      // Oynada sarlavha, qidiruv va 3 market — matn elementlari kam.
      await check({ minElements: 5 });
      await dialog.getByRole("option", { name: /Baraka Shop/ }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Baraka Shop/ })).toBeVisible();
      await check();
    },
  },
  {
    path: "/payments?cashbox_type=main",
    role: "superadmin",
    api: {
      "finance/cashbox/main": fixture("finance/cashbox-main.json"),
      "finance/cashbox/all-info": fixture("finance/all-info.json"),
      "finance/shift/current": fixture("finance/shift-open.json"),
      "finance/history": fixture("finance/history-payments.json"),
      users: fixture("finance/staff-users.json"),
    },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByText("Aliyev Vali").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    path: "/all-users",
    role: "superadmin",
    api: { users: fixture("users/users.json") },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByText("Mehr Kosmetika").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    path: "/settings",
    role: "registrator",
    api: {},
    ready: async (page) => {
      await expect(page.getByRole("main").getByRole("tab").first()).toBeVisible({ timeout: 90_000 });
    },
    // Har bo'lim (telefonda ham tablar).
    run: async (page, check) => {
      const tabs = page.getByRole("main").getByRole("tab");
      const count = await tabs.count();
      expect(count).toBeGreaterThan(2);
      for (let index = 0; index < count; index += 1) {
        await tabs.nth(index).click();
        await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
        await check();
      }
    },
  },
  {
    path: "/regions",
    role: "admin",
    api: { "region/stats/all": REGIONS, "region/stats/1": REGION_DETAIL },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByText("Toshkent sh.").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    },
    // Xarita sahifasi, so'ng jadval egizagidan «Toshkent shahri» oynasi.
    run: async (page, check) => {
      await check();
      await page.getByRole("radio", { name: "Jadval" }).first().click();
      await page.getByRole("button", { name: "Toshkent shahri", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Chilonzor tumani").first()).toBeVisible({ timeout: 30_000 });
      await check();
    },
  },
  {
    path: "/activity-logs",
    role: "superadmin",
    api: {
      "activity-logs/actions": { statusCode: 200, ...CATALOG },
      "activity-logs": { statusCode: 200, data: { items: LOGS, meta: { page: 1, limit: 20, total: LOGS.length, totalPages: 1 } } },
    },
    ready: async (page) => {
      await heading(page);
      await expect(page.getByText("Jasur Tursunov").filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    },
  },
];

/** Soxta backend + sessiya; `leaked` — taqiqlangan yozish so'rovlari. */
export const openContrastPage = async (page: Page, target: ContrastPage, theme: Theme) => {
  const leaked: string[] = [];
  // Ilova manzili — `playwright.config.ts` dagi `baseURL` dan (port qo'lda takrorlanmaydi).
  const appOrigin = new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
  const cors = {
    "access-control-allow-origin": appOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, profile(target.role, theme));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path in target.api) return reply(route, target.api[path]);
    return reply(route, empty);
  });
  await page.addInitScript((sessionTheme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", sessionTheme);
    window.localStorage.setItem("theme-version", "2");
  }, theme);

  await page.goto(target.path);
  await target.ready(page);
  // Mavzu haqiqatan chizilgan: `html.dark` va kanvas rangi (sozlama sinxronidan keyin ham).
  const html = page.locator("html");
  if (theme === "dark") await expect(html).toHaveClass(/\bdark\b/);
  else await expect(html).not.toHaveClass(/\bdark\b/);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor), { timeout: 30_000 })
    .toBe(theme === "dark" ? "rgb(13, 17, 32)" : "rgb(244, 246, 251)");
  return { leaked };
};
