import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * DASHBOARD TAQQOSLASH GRAFIGI (PMa5dgYQ) — 1440px.
 * - 10 tadan ortiq market/kuryer → 10 ta ustun + "Yana ko'rsatish" → hammasi → "Kamroq ko'rsatish" → 10.
 * - Market roli: grafik TO'LIQ `markets` statistikasidan (topMarkets bo'sh bo'lsa ham).
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

const markets = Array.from({ length: 12 }, (_, i) => ({
  market: { id: `m${i + 1}`, name: `Market ${String(i + 1).padStart(2, "0")}` },
  totalOrders: 20,
  soldOrders: 20 - i,
  sellingRate: ((20 - i) / 20) * 100,
}));
const couriers = Array.from({ length: 12 }, (_, i) => ({
  courier: { id: `c${i + 1}`, name: `Kuryer ${String(i + 1).padStart(2, "0")}` },
  totalOrders: 10,
  soldOrders: 10 - (i % 10),
  canceledOrders: 0,
  successRate: ((10 - (i % 10)) / 10) * 100,
}));

const mockDashboard = async (page: Page, profile: Record<string, unknown>, dashboard: Record<string, unknown>) => {
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: profile });
    if (path === "analytics/dashboard") return reply(route, { statusCode: 200, message: "ok", data: dashboard });
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
  return leaked;
};

const section = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });

test.describe("Dashboard — taqqoslash grafigi, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC5: 10 tadan ortiq bo'lganda \"Yana ko'rsatish\" hammasini ochadi, \"Kamroq ko'rsatish\" yana 10 ga qaytaradi", async ({ page }) => {
    const leaked = await mockDashboard(
      page,
      { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
      { orders: { acceptedCount: 240 }, markets, couriers, topMarkets: [], topCouriers: [] },
    );
    await page.goto("/");

    for (const title of ["Marketlar bo'yicha sotuv foizi", "Kuryerlar bo'yicha sotuv foizi"]) {
      const block = section(page, title);
      await page.getByRole("heading", { name: title }).scrollIntoViewIfNeeded({ timeout: 60_000 });
      const bars = block.locator(".recharts-bar-rectangle");
      await expect(bars, title).toHaveCount(10);

      await block.getByRole("button", { name: "Yana ko'rsatish" }).click();
      await expect(bars, title).toHaveCount(12);
      await expect(block.getByRole("button", { name: "Kamroq ko'rsatish" })).toBeVisible();

      await block.getByRole("button", { name: "Kamroq ko'rsatish" }).click();
      await expect(bars, title).toHaveCount(10);
      await expect(block.getByRole("button", { name: "Yana ko'rsatish" })).toBeVisible();
    }
    expect(leaked).toEqual([]);
  });

  test("10 ta yoki kam bo'lsa \"Yana ko'rsatish\" tugmasi chiqmaydi", async ({ page }) => {
    await mockDashboard(
      page,
      { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
      { orders: { acceptedCount: 200 }, markets: markets.slice(0, 10), couriers: couriers.slice(0, 4) },
    );
    await page.goto("/");
    const block = section(page, "Marketlar bo'yicha sotuv foizi");
    await page.getByRole("heading", { name: "Marketlar bo'yicha sotuv foizi" }).scrollIntoViewIfNeeded({ timeout: 60_000 });
    await expect(block.locator(".recharts-bar-rectangle")).toHaveCount(10);
    await expect(block.getByRole("button", { name: "Yana ko'rsatish" })).toHaveCount(0);
  });

  test("⭐ market roli: o'z statistikasi grafikda (topMarkets bo'sh bo'lsa ham), kuryerlar bo'limi yo'q", async ({ page }) => {
    const leaked = await mockDashboard(
      page,
      { id: "37", role: "market", name: "TEST Claude Market", status: "active" },
      {
        orders: { acceptedCount: 11 },
        myStat: { totalOrders: 11, soldOrders: 4, canceledOrders: 1, profit: 0, successRate: 36.36 },
        markets: [{ market: { id: "37", name: "TEST Claude Market" }, totalOrders: 11, soldOrders: 4, sellingRate: 36.36 }],
        topMarkets: [],
      },
    );
    await page.goto("/");
    await page.getByRole("heading", { name: "Marketlar bo'yicha sotuv foizi" }).scrollIntoViewIfNeeded({ timeout: 60_000 });
    const block = section(page, "Marketlar bo'yicha sotuv foizi");
    await expect(block.locator(".recharts-bar-rectangle")).toHaveCount(1);
    await expect(block.getByText("Hali solishtirish uchun yetarli ma'lumot yo'q.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Kuryerlar bo'yicha sotuv foizi" })).toHaveCount(0);

    // Tooltip API qiymatini ko'rsatadi: 36.4% · 4/11.
    await block.locator(".recharts-bar-rectangle").first().hover();
    await expect(block.getByText(/36\.4%/)).toBeVisible();
    await expect(block.getByText(/4\/11/)).toBeVisible();
    expect(leaked).toEqual([]);
  });
});
