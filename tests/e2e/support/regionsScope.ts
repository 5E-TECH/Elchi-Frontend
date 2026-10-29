import { expect, type Page, type Route } from "@playwright/test";

/**
 * aLx7Di99 — menejer / kuryer `/regions` (`GET region/my/district-stats`): raqamlar so'rovchi kesimida,
 * javobda `data.scope` (`branch` + `branch_name` yoki `courier`). Soxta backend faqat o'qish so'rovlariga javob
 * beradi, yozish — `leaked`.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

type Role = "manager" | "courier";

const SCOPE = {
  manager: { type: "branch", branch_id: "7", branch_name: "Urgut filiali" },
  courier: { type: "courier", courier_id: "5" },
} as const;

const stats = (role: Role) => ({
  region: { id: "14", name: "Samarqand viloyati", satoCode: "1718" },
  scope: SCOPE[role],
  summary: {
    totalOrders: 12,
    deliveredOrders: 8,
    cancelledOrders: 1,
    pendingOrders: 3,
    totalRevenue: 2_400_000,
    successRate: 67,
    districtsCount: 2,
  },
  districts: [
    {
      id: "141",
      name: "Urgut tumani",
      satoCode: "1718224",
      totalOrders: 9,
      deliveredOrders: 6,
      cancelledOrders: 1,
      pendingOrders: 2,
      totalRevenue: 1_800_000,
      successRate: 67,
      couriersCount: 2,
    },
    {
      id: "142",
      name: "Bulung'ur tumani",
      satoCode: "1718212",
      totalOrders: 3,
      deliveredOrders: 2,
      cancelledOrders: 0,
      pendingOrders: 1,
      totalRevenue: 600_000,
      successRate: 67,
      couriersCount: 1,
    },
  ],
});

export const openScopedRegions = async (page: Page, role: Role) => {
  const mock = { leaked: [] as string[], requested: [] as string[] };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    if (method === "GET") mock.requested.push(path);
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({
          id: role === "courier" ? "5" : "9",
          role,
          name: role === "courier" ? "Jasur Tursunov" : "Aziz Rahimov",
          status: "active",
          ...(role === "manager"
            ? { branch_id: "7", branch: { id: "7", name: "Urgut filiali", type: "REGIONAL" } }
            : {}),
        }),
      );
    }
    if (path === "region/my/district-stats") return reply(route, wrap(stats(role)));
    if (path === "district") {
      return reply(
        route,
        wrap([
          { id: "141", name: "Urgut tumani", region_id: "14" },
          { id: "142", name: "Bulung'ur tumani", region_id: "14" },
          { id: "143", name: "Ishtixon tumani", region_id: "14" },
        ]),
      );
    }
    if (method !== "GET") {
      mock.leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  await page.goto("/regions");
  await expect(
    page.getByRole("heading", { level: 1, name: "Samarqand viloyati — tumanlar statistikasi" }),
  ).toBeVisible({ timeout: 90_000 });
  return mock;
};

export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
};
