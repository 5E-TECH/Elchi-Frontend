import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Route } from "@playwright/test";

/**
 * fYgDe3MW — /regions xaritasi klaviatura va skrin-riderga ochiq: Highcharts `accessibility` moduli ulangan (konsolda
 * «Highcharts warning» yo'q), xarita konteyneri — nomli mintaqa (`role` + `aria-label`), Tab — xarita ichidagi
 * viloyatga, uning tavsifi o'qiladi. Ma'lumot — «Visual» fixture'i, soxta backend, 1440px.
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
const REGIONS = JSON.parse(readFileSync(resolve("tests/visual/fixtures/regions/stats-all.json"), "utf8"));

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ /regions: «Highcharts warning» yo'q, xarita — nomli mintaqa, Tab bilan viloyatga o'tiladi", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/Highcharts warning/i.test(message.text())) warnings.push(message.text());
  });
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
    if (path === "region/stats/all") return reply(route, REGIONS);
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

  await page.goto("/regions");
  const map = page.getByRole("region", { name: "Viloyatlar xaritasi. Interaktiv xarita.", exact: true });
  await expect(map).toBeVisible({ timeout: 90_000 });
  await expect(map.locator("path.highcharts-point").first()).toBeVisible();

  // «Grafik | Jadval» dan keyin Tab — xaritaga, fokus birinchi viloyatda (tavsifi bilan).
  await page.getByRole("radiogroup", { name: "Viloyatlar xaritasi ko'rinishi" }).getByRole("radio", { name: "Grafik" }).focus();
  let label = "";
  for (let step = 0; step < 6 && !/viloyat|Respublikasi|shahri/i.test(label); step += 1) {
    await page.keyboard.press("Tab");
    label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  }
  expect(label).toMatch(/: \d+ ta buyurtma, .+ muvaffaqiyat, .+ tushum/);
  expect(await map.evaluate((node) => node.contains(document.activeElement))).toBe(true);

  // Strelka — keyingi viloyat.
  await page.keyboard.press("ArrowRight");
  const next = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  expect(next).toMatch(/: \d+ ta buyurtma/);
  expect(next).not.toBe(label);

  expect(warnings).toEqual([]);
});
