import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Celz3rKJ — «Balans → AI xarajat» (`/financial-balance?tab=ai`) uchun soxta gateway (superadmin): `GET /ai-usage/dashboard`
 * va `GET /ai-usage/ai-orders` (kontrakt — backend FRONTEND_CHANGELOG 2026-10-14 «Guruh H», 2026-10-15 bot manbasi).
 * Kunlik seriya so'ralgan `fromDate`…`toDate` dan quriladi. Yozish so'rovlari taqiqlangan. Ilova manzili — `baseURL`.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const daysBetween = (from: string, to: string) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Array.from({ length: Math.round((end - start) / DAY) + 1 }, (_, index) => iso(start + index * DAY));
};

const dashboard = (params: URLSearchParams, failSources: boolean) => {
  const to = params.get("toDate") ?? iso(Date.now());
  const from = params.get("fromDate") ?? iso(Date.parse(`${to}T00:00:00Z`) - 29 * DAY);
  return {
    from,
    to,
    usdUzsRate: 12_650,
    summary: {
      totalCostUsd: 12.4,
      totalCostUzs: 156_860,
      totalCalls: 412,
      cacheSavedUsd: 1.1,
      cacheSavedUzs: 13_915,
      metaIncompleteCalls: 0,
      linkedCalls: 380,
      aiOrderCount: 96,
      orderCostUsd: 11.2,
      orderCostUzs: 141_680,
      avgCostPerAiOrderUsd: 0.12,
      avgCostPerAiOrderUzs: 1_476,
    },
    byArea: [{ area: "order", calls: 412, inputTokens: 512_000, outputTokens: 61_000, costUsd: 12.4, costUzs: 156_860 }],
    byFeature: [
      { feature: "order_extract_multi", area: "order", calls: 120, steps: 120, inputTokens: 300_000, outputTokens: 40_000, costUsd: 7.9, costUzs: 99_935 },
      { feature: "order_extract_image", area: "order", calls: 40, steps: 40, inputTokens: 150_000, outputTokens: 12_000, costUsd: 3.1, costUzs: 39_215 },
      { feature: "order_district", area: "order", calls: 200, steps: 200, inputTokens: 50_000, outputTokens: 6_000, costUsd: 1.1, costUzs: 13_915 },
      { feature: "order_item_match", area: "order", calls: 52, steps: 52, inputTokens: 12_000, outputTokens: 3_000, costUsd: 0.3, costUzs: 3_795 },
    ],
    byModel: [
      { model: "claude-haiku-4-5", calls: 360, costUsd: 9.3, costUzs: 117_645 },
      { model: "claude-sonnet-4-5", calls: 52, costUsd: 3.1, costUzs: 39_215 },
    ],
    dailySeries: daysBetween(from, to).map((day, index) => ({
      day,
      costUsd: (index % 5) * 0.12,
      costUzs: (index % 5) * 1_518,
      calls: (index % 5) * 4,
      aiOrders: index % 5,
    })),
    orderSources: failSources
      ? null
      : {
          total: 1_000,
          ai: 96,
          manual: 704,
          bot: 60,
          external: 100,
          branch: 40,
          shares: { ai: 9.6, manual: 70.4, bot: 6, external: 10, branch: 4 },
          applied_range: null,
        },
    degraded: failSources,
    failed_parts: failSources ? ["orderSources"] : [],
  };
};

const aiOrders = {
  total: 2,
  limit: 100,
  items: [
    {
      orderId: "81",
      orderNumber: "EL-100081",
      status: "sold",
      totalPrice: 185_000,
      draftId: "d-1",
      marketId: "37",
      confirmedBy: "1",
      editedFields: [],
      createdAt: "2026-10-26T07:12:00.000Z",
      model: "claude-haiku-4-5",
      sourceKind: "text",
      draftCostUsd: 0.12,
      draftCostUzs: 1_518,
      draftOrders: 3,
    },
    {
      orderId: "82",
      orderNumber: "EL-100082",
      status: "on the road",
      totalPrice: 92_000,
      draftId: "d-2",
      marketId: "37",
      confirmedBy: "1",
      editedFields: ["district"],
      createdAt: "2026-10-25T15:40:00.000Z",
      model: "claude-sonnet-4-5",
      sourceKind: "image",
      draftCostUsd: 0.3,
      draftCostUzs: 3_795,
      draftOrders: 1,
    },
  ],
  degraded: false,
};

export const openAiCost = async (
  page: Page,
  { theme = "light", failSources = false }: { theme?: "light" | "dark"; failSources?: boolean } = {},
) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, data: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ statusCode: 200, message: "ok", data }) });
  const requests = { dashboard: [] as URLSearchParams[], orders: [] as URLSearchParams[], leaked: [] as string[] };

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
    if (path === "ai-usage/dashboard") {
      requests.dashboard.push(url.searchParams);
      return reply(route, dashboard(url.searchParams, failSources));
    }
    if (path === "ai-usage/ai-orders") {
      requests.orders.push(url.searchParams);
      return reply(route, aiOrders);
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
  await page.goto("/financial-balance");
  const tab = page.getByRole("tab", { name: "AI xarajat" });
  await expect(tab).toBeVisible({ timeout: 90_000 });
  return { tab, requests };
};

export const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
