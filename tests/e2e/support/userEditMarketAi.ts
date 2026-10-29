import { expect, type Page, type Route } from "@playwright/test";

/**
 * FY-1 — market tafsiloti (`/all-users/40`) va «Tahrirlash» oynasidagi «AI narxi (1 buyurtma)» (maket
 * `superadmin-users-edit-market-ai`, `-phone`). Soxta backend: superadmin, market (AI narxi 250 so'm); `PATCH
 * users/40` tanalari yig'iladi va javobda yozuv yangilanadi. Serverga so'rov ketmaydi (jonli kanal ham yopiladi).
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

const MARKET = {
  id: "40",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka_shop",
  role: "market",
  status: "active",
  salary: 0,
  payment_day: null,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "address",
  ai_price_per_order: 250,
  add_order: true,
  cancelled_handover_qr_required: true,
  expense_proof_conditions: [],
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
};

export const openMarketDetail = async (page: Page) => {
  const patches: Array<Record<string, unknown>> = [];
  let market: Record<string, unknown> = { ...MARKET };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "E2E", status: "active" } });
    }
    if (path === "users/40" && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      patches.push(body);
      market = { ...market, ...body };
      return reply(route, { statusCode: 200, data: market });
    }
    if (path === "users/40") return reply(route, { statusCode: 200, data: market });
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
  await page.goto("/all-users/40");
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Baraka Shop" })).toBeVisible({ timeout: 90_000 });
  return { content, patches };
};
