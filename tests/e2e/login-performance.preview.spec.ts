import { devices, expect, test, type Route } from "@playwright/test";

/**
 * KIRISH SAHIFASI TEZLIGI (rzzxMItN) — PROD BUILD, iPhone 12, CPU 4× sekin, tarmoq 1,6 Mbit/s / 150 ms (CDP).
 * Byudjet: LCP < 2500 ms, JS < 350 KB (sim orqali o'tgan bayt), CLS < 0,1 (hozir: ≈ 2,2 s / 240 KB / 0;
 * ilgari 3,1 s / 372 KB).
 *   - `/login` da o'zbekcha tarjimalarning yadrodan tashqari qismi (`uzRest`) yuklanmaydi, antd ham yo'q;
 *   - kirish sahifasi moduli chizishdan oldin keladi (`app/lib/loginPage.tsx`) — «Ilova yuklanmoqda» ekrani
 *     (Suspense) chaqnamaydi, birinchi chizishda forma;
 *   - kirish tugmasi bosilgach u so'rov bilan parallel keladi — bosh sahifa matni kalit emas, o'zbekcha.
 */
const ORIGIN = "http://127.0.0.1:4175";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const LCP_BUDGET_MS = 2500;
const JS_BUDGET_BYTES = 350 * 1024;
const CLS_BUDGET = 0.1;

// iPhone 12 o'lchami va UA — dvigatel loyihaniki (Chromium: CDP faqat unda).
const iphone = devices["iPhone 12"];
test.use({
  viewport: iphone.viewport,
  userAgent: iphone.userAgent,
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});
test.describe.configure({ timeout: 180_000 });

test("⭐ /login sekin tarmoqda: LCP < 2,5 s, JS < 350 KB, CLS < 0,1; kirgach sahifa o'zbekcha", async ({ page, context }) => {
  await context.route(/api\.elchipochta\.uz|:3004\//, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (path === "auth/login") return reply(route, { accessToken: "e2e.local.token", accessTokenExpiresAt: Date.now() + 86_400_000 });
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const perf = { lcp: 0, cls: 0, loader: false };
    (window as unknown as { __perf: typeof perf }).__perf = perf;
    new MutationObserver(() => {
      if (document.querySelector('[role="status"][aria-label="Ilova yuklanmoqda"]')) perf.loader = true;
    }).observe(document, { childList: true, subtree: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) perf.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) perf.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const scripts = new Map<string, string>();
  let jsBytes = 0;
  cdp.on("Network.responseReceived", (event) => {
    if (event.type === "Script") scripts.set(event.requestId, new URL(event.response.url).pathname);
  });
  cdp.on("Network.loadingFinished", (event) => {
    if (scripts.has(event.requestId)) jsBytes += event.encodedDataLength;
  });

  await page.goto("/login");
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 60_000 });
  // LCP nomzodi kirish formasi chizilgach yakunlanadi; kechroq siljish ham hisobga olinsin.
  await page.waitForTimeout(2000);
  const perf = await page.evaluate(() => (window as unknown as { __perf: { lcp: number; cls: number; loader: boolean } }).__perf);
  const loaded = [...scripts.values()];

  expect(perf.lcp).toBeGreaterThan(0);
  expect(perf.lcp).toBeLessThan(LCP_BUDGET_MS);
  expect(perf.cls).toBeLessThan(CLS_BUDGET);
  expect(perf.loader).toBe(false);
  expect(jsBytes).toBeLessThan(JS_BUDGET_BYTES);
  expect(loaded.filter((path) => /uzRest-|jspdf|antd/i.test(path))).toEqual([]);

  // Tarmoq cheklovi olinadi — kirish oqimi tekshiriladi.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.locator('input[name="elchi-login-phone"]').fill("901234567");
  await page.locator('input[name="password"]').fill("parol123");
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });

  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeVisible({ timeout: 60_000 });
  expect([...scripts.values()].some((path) => /uzRest-/.test(path))).toBe(true);
  // Yadrodan tashqari nomlar fazosi (`dashboard`, `sidebar`) matni — kalit emas, o'zbekcha.
  await expect(content.getByRole("radio", { name: "Bu hafta" })).toBeVisible();
  await expect(content).toContainText("Bugungi ko'rsatkichlar");
  await expect(content).not.toContainText("v2Dashboard.");
});
