import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * DASHBOARD BIRINCHI YUKLASH JS BYUDJETI (NIFAnCvf, TC3) — PROD BUILD.
 *
 * Dashboard sovuq ochiladi (skroll yo'q), brauzer olgan BARCHA `.js` fayllar
 * yig'iladi va `dist/` dagi o'sha fayllarning gzip hajmi qo'shiladi
 * (tester o'lchovi bilan bir xil: "Dashboard birinchi yuklash JS").
 * Byudjet: 450 KB gzip — 1440 va 390 da.
 *
 * Ma'lumot — haqiqiy shaklda («Visual» sahnasining fixture'lari: KPI, reytinglar, «Moliyaviy tahlil» grafigi
 * nuqtalari, hududlar). Bo'sh `[]` bilan grafik umuman chizilmasdi va test prod'dagi 529 KB ni (2026-10-19,
 * 1440px) ko'rmasdi. Prod'dagidek daromad (grafik) tez, dashboard / KPI sekin keladi: yuqoridagi bloklar hali
 * skelet (past) — grafik shu qisqa paytda birinchi ekranga tushib, Recharts'ni yuklab yubormasligi kerak.
 */
const ORIGIN = "http://127.0.0.1:4175";
const BUDGET_BYTES = 450 * 1024;
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
/** Prod'dagi kabi: `analytics/dashboard` va `analytics/kpi` sekin (og'ir agregatsiya), daromad tez. */
const SLOW_MS = 1500;
const delayed = (route: Route, body: unknown) => new Promise((done) => setTimeout(done, SLOW_MS)).then(() => reply(route, body));

const openDashboardCold = async (page: Page) => {
  const scripts = new Set<string>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === ORIGIN && url.pathname.endsWith(".js") && url.pathname !== "/sw.js") scripts.add(decodeURIComponent(url.pathname));
  });
  await page.context().route(/api\.elchipochta\.uz|:3004\//, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "analytics/revenue") return reply(route, SUPERADMIN.revenue.current);
    if (path === "analytics/dashboard") return delayed(route, SUPERADMIN.dashboard.current);
    if (path === "analytics/kpi") return delayed(route, SUPERADMIN.kpi.current);
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
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  // Kechiktirilgan (birinchi ekrandagi) bloklar mount bo'lishiga vaqt.
  await page.waitForTimeout(2500);
  await page.waitForLoadState("networkidle");

  const files = [...scripts].map((path) => {
    const gz = gzipSync(readFileSync(resolve("dist", path.replace(/^\//, ""))), { level: 9 }).length;
    return { path, gz };
  });
  return files.sort((a, b) => b.gz - a.gz);
};

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 664 },
]) {
  test(`⭐ Dashboard ${viewport.width}px: birinchi yuklash JS ≤ 450 KB gzip, xarita chunki yo'q`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage();
    const files = await openDashboardCold(page);
    const total = files.reduce((sum, file) => sum + file.gz, 0);
    console.log(
      `[${viewport.width}px] JS ${files.length} fayl, ${(total / 1024).toFixed(1)} KB gzip\n` +
        files.map((file) => `  ${(file.gz / 1024).toFixed(1).padStart(6)} KB  ${file.path}`).join("\n"),
    );
    // Xarita (Highcharts) birinchi ekranda yuklanmaydi (TC1 regressiyasi).
    expect(files.some((file) => /UzbekistanRegionMap|highcharts/i.test(file.path))).toBe(false);
    // ru/en tarjimalari standart tilda yuklanmaydi.
    expect(files.some((file) => /locale-(ru|en)/.test(file.path))).toBe(false);
    expect(total).toBeLessThanOrEqual(BUDGET_BYTES);
    // Recharts (Moliyaviy tahlil grafigi) birinchi ekranda yuklanmaydi — prod 1440px da shu 85 KB oshirardi.
    expect(files.some((file) => /CartesianChart|FinancialTrendPlot/.test(file.path))).toBe(false);

    // Grafikka skroll qilinsa — chunk yuklanadi va grafik chiziladi (kechiktirish ishlayveradi).
    const chart = page.getByRole("figure", { name: /^Daromad, / });
    await chart.scrollIntoViewIfNeeded();
    await expect(chart.locator(".recharts-surface")).toBeVisible({ timeout: 30_000 });
    await context.close();
  });
}
