import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/all-users` (84IDGRDp) — soxta backend: superadmin, 10 ta foydalanuvchi, 129 sahifa, KPI (1 286 · 342 · 118).
 * Serverga so'rov ketmaydi (jonli kanal WebSocket'i ham yopiladi).
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

const ROLES = ["market", "courier", "manager", "registrator", "admin"] as const;
export const ITEMS = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  name: `Foydalanuvchi ${i + 1}`,
  phone_number: `+99890${String(1_000_000 + i * 7).padStart(7, "0")}`,
  role: ROLES[i % ROLES.length],
  status: i % 4 === 3 ? "inactive" : "active",
  createdAt: "2026-10-01T09:40:00.000Z",
}));
const META = { page: 1, limit: 10, total: 1286, totalPages: 129, totalUsers: 1286, totalMarket: 342, totalEmployees: 118 };

export const openUsers = async (page: Page) => {
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "99", role: "superadmin", name: "E2E", status: "active" } });
    }
    if (path === "users") return reply(route, { statusCode: 200, data: { items: ITEMS, meta: META } });
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
  await page.goto("/all-users");
  await expect(page.getByText("Foydalanuvchi 1", { exact: true })).toBeVisible({ timeout: 90_000 });
};

