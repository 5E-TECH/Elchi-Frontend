import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/notifications` (NG-A) — soxta backend: ADMIN (ega NG-S2), 3 ta Telegram guruhi (biri nofaol), marketlar ro'yxati.
 * `PATCH /notifications/:id` tanasini yozib oladi va ro'yxatda holatni yangilaydi (`is_active`). Serverga so'rov
 * ketmaydi (jonli kanal WebSocket'i ham yopiladi).
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

const MARKETS = [
  { id: 12, name: "Baraka Shop", phone_number: "+998901112233" },
  { id: 27, name: "Nur Elektronika", phone_number: "+998901234567" },
  { id: 52, name: "Bahor Kiyim", phone_number: "+998904123675" },
];

const initialGroups = () => [
  { id: "7", market_id: "12", group_id: "-1002184736577", group_type: "cancel", bot_slug: null, is_active: true, createdAt: "2026-10-20T10:14:00+05:00" },
  { id: "8", market_id: "27", group_id: "-1001937420815", group_type: "create", bot_slug: null, is_active: false, createdAt: "2026-10-19T17:45:00+05:00" },
  { id: "9", market_id: "52", group_id: "-1002251846630", group_type: "cancel", bot_slug: null, is_active: true, createdAt: "2026-09-24T18:16:00+05:00" },
];

export type NotificationGroupsMock = {
  /** `PATCH /notifications/:id` tanalari (`{ id, body }`). */
  patches: { id: string; body: unknown }[];
};

export const openNotificationGroups = async (page: Page): Promise<NotificationGroupsMock> => {
  const groups = initialGroups();
  const mock: NotificationGroupsMock = { patches: [] };
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "2", role: "admin", name: "E2E Admin", status: "active" } });
    }
    if (path === "markets") return reply(route, { statusCode: 200, data: { items: MARKETS } });
    if (path === "notifications" && request.method() === "GET") {
      return reply(route, {
        statusCode: 200,
        data: { items: groups, pagination: { total: groups.length, page: 1, limit: 10, totalPages: 1 } },
      });
    }
    const byId = /^notifications\/(\d+)$/.exec(path);
    if (byId && request.method() === "PATCH") {
      const body = request.postDataJSON() as { is_active?: boolean };
      mock.patches.push({ id: byId[1], body });
      const group = groups.find((item) => item.id === byId[1]);
      if (group && typeof body.is_active === "boolean") group.is_active = body.is_active;
      return reply(route, { statusCode: 200, data: group ?? {} });
    }
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
  await page.goto("/notifications");
  await expect(page.getByText("Baraka Shop", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
  return mock;
};

/** Sahifada gorizontal oqib ketish yo'q (hujjat ham, shell kontenti ham). */
export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};
