import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * o2j9uDtT — bosh sahifa hudud kartasi («Hududlar», umumiy xarita): backend `region/stats/all` da identity javob
 * bermasa `activeCouriers: null` — «Faol kuryerlar» «—», «N hududda» izohi yo'q (yolg'on «0 ta» emas). Kuryerlar
 * soni kelsa — avvalgidek. Ma'lumot — «Visual» fixture'lari, soxta backend, 1440px.
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
const fixture = (path: string) => JSON.parse(readFileSync(resolve("tests/visual/fixtures", path), "utf8"));
const SUPERADMIN = fixture("dashboard/superadmin.json");
const REGIONS = fixture("regions/stats-all.json");

const withCouriers = (known: boolean) => {
  const stats = structuredClone(REGIONS);
  if (!known) {
    for (const region of stats.data.regions) {
      region.activeCouriers = null;
      region.totalCouriers = null;
    }
  }
  return stats;
};

const openRegionCard = async (page: Page, stats: unknown) => {
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "analytics/dashboard") return reply(route, SUPERADMIN.dashboard.current);
    if (path === "analytics/kpi") return reply(route, SUPERADMIN.kpi.current);
    if (path === "analytics/revenue") return reply(route, SUPERADMIN.revenue.current);
    if (path === "region/stats/all") return reply(route, stats);
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
  await page.goto("/");
  await expect(page.getByRole("radio", { name: "Bugun" })).toBeVisible({ timeout: 90_000 });
  // Hudud kartasi pastda, ekranga yaqinlashganda yuklanadi. Sichqoncha kontent ustida (chapda yon menyu).
  const term = page.getByText("Faol kuryerlar", { exact: true });
  await page.mouse.move(800, 450);
  for (let i = 0; i < 20 && !(await term.isVisible()); i += 1) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(250);
  }
  await expect(term).toBeVisible({ timeout: 30_000 });
  return term.locator("xpath=..");
};

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

test("⭐ activeCouriers null — «Faol kuryerlar» «—», «N hududda» yo'q (yolg'on 0 emas)", async ({ page }) => {
  const block = await openRegionCard(page, withCouriers(false));
  await expect(block.locator("dd").first()).toHaveText("—");
  await expect(block).not.toContainText("0 ta");
  await expect(block).not.toContainText("hududda");
});

test("kuryerlar soni kelsa — «N ta» va «N hududda» (avvalgidek)", async ({ page }) => {
  const block = await openRegionCard(page, withCouriers(true));
  await expect(block.locator("dd").first()).toHaveText(/^\d[\d\s]* ta$/);
  await expect(block).toContainText("hududda");
});
