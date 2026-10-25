import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * DASHBOARD REYTINGLARI (PMa5dgYQ) — 1440px, dizayn v2 (`RankList`, maket `superadmin-dashboard-main`).
 * - Top 5 dan ortiq market/kuryer → 5 ta qator + "Yana ko'rsatish · {n} ta" → hammasi → "Kamroq ko'rsatish" → 5.
 *   (v1 recharts grafigi 10 ta ustun ko'rsatardi; v2 maketida reyting top 5, telefonda top 3.)
 * - Market roli: «Marketlar bo'yicha sotuv foizi» TO'LIQ `markets` statistikasidan — o'z qatori
 *   (topMarkets bo'sh bo'lsa ham), kuryerlar bo'limi yo'q.
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

  test("⭐ TC5: top 5 dan ortiq bo'lganda \"Yana ko'rsatish\" hammasini ochadi, \"Kamroq ko'rsatish\" yana 5 ga qaytaradi", async ({ page }) => {
    const leaked = await mockDashboard(
      page,
      { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
      { orders: { acceptedCount: 240 }, markets, couriers, topMarkets: [], topCouriers: [] },
    );
    await page.goto("/");

    for (const title of ["Top marketlar", "Top kuryerlar"]) {
      const block = section(page, title);
      const rows = block.locator("[data-rank-row]");
      // Yuklanish kartasi (skelet) o'rnini haqiqiy karta egallaguncha kutiladi, keyin skroll.
      await expect(rows, title).toHaveCount(5, { timeout: 60_000 });
      await block.scrollIntoViewIfNeeded();

      await block.getByRole("button", { name: "Yana ko'rsatish · 7 ta" }).click();
      await expect(rows, title).toHaveCount(12);
      await expect(block.getByRole("button", { name: "Kamroq ko'rsatish" })).toBeVisible();

      await block.getByRole("button", { name: "Kamroq ko'rsatish" }).click();
      await expect(rows, title).toHaveCount(5);
      await expect(block.getByRole("button", { name: /Yana ko'rsatish/ })).toBeVisible();
    }
    expect(leaked).toEqual([]);
  });

  test("5 ta yoki kam bo'lsa \"Yana ko'rsatish\" tugmasi chiqmaydi (desktop)", async ({ page }) => {
    await mockDashboard(
      page,
      { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
      { orders: { acceptedCount: 200 }, markets: markets.slice(0, 5), couriers: couriers.slice(0, 4) },
    );
    await page.goto("/");
    const block = section(page, "Top marketlar");
    await expect(block.locator("[data-rank-row]")).toHaveCount(5, { timeout: 60_000 });
    await block.scrollIntoViewIfNeeded();
    await expect(block.getByRole("button", { name: /Yana ko'rsatish/ })).toHaveCount(0);
  });

  test("⭐ market roli: o'z statistikasi sotuv foizida (topMarkets bo'sh bo'lsa ham), kuryerlar bo'limi yo'q", async ({ page }) => {
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
    const block = section(page, "Marketlar bo'yicha sotuv foizi");
    await expect(block.locator("[data-hbar-row]")).toHaveCount(1, { timeout: 60_000 });
    await block.scrollIntoViewIfNeeded();
    await expect(block.getByText("Reyting uchun ma'lumot hali kam")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Top kuryerlar" })).toHaveCount(0);

    // Qatorda API qiymati: 36,4% · 4 / 11 ta, o'z qatori «Siz».
    const row = block.locator("[data-hbar-row]").first();
    await expect(row).toContainText("TEST Claude Market");
    await expect(row).toContainText("Siz");
    await expect(row).toContainText("36,4%");
    await expect(row).toContainText("4 / 11 ta");
    expect(leaked).toEqual([]);
  });
});
