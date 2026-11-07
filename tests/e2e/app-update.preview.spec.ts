import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * «YANGI VERSIYA» BANNERI — PROD BUILD ustida (`features/app-update`). Ilova ochiq turganda serverga yangi versiya
 * chiqishi soxtalanadi: brauzerdagi `fetch("/")` javobida entry skript nomi boshqa (hujjatning o'zi qayta
 * yuklanmaydi). Vaqt — Playwright soati (5 daqiqalik tekshiruv, 1 daqiqalik oraliq).
 */
const ORIGIN = "http://127.0.0.1:4175";
const NEW_ENTRY = "/assets/index-NEWVERSION.js";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

/** Menejer sessiyasi + yozishsiz soxta backend (`push.preview.spec.ts` dagidek). */
const loggedInManager = async (context: BrowserContext) => {
  await context.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  await context.route(/api\.elchipochta\.uz|:3004\//, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "42", role: "manager", name: "E2E menejer", status: "active", settings: {} }));
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, wrap([]));
  });
};

const blockApi = (context: BrowserContext) =>
  context.route(/api\.elchipochta\.uz|:3004\//, (route) => route.abort());

/** Bundan keyin `fetch("/")` serverdagi «yangi» `index.html` ni oladi (entry nomi boshqa). Sahifa o'zi o'zgarmaydi. */
const releaseNewVersion = async (page: Page) => {
  const current = await (await page.request.get("/")).text();
  const next = current.replace(/(<script type="module"[^>]*src=")[^"]+(")/, `$1${NEW_ENTRY}$2`);
  expect(next).not.toBe(current);
  let served = 0;
  await page.route(`${ORIGIN}/`, (route) => {
    served += 1;
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: next });
  });
  return () => served;
};

const banner = (page: Page) => page.locator("[data-update-banner]");

test.describe("yangi versiya banneri", () => {
  test("⭐ login sahifasi: 5 daqiqalik tekshiruvda chiqadi, «Yangilash» sahifani qayta yuklaydi", async ({ page, context }) => {
    await blockApi(context);
    await page.clock.install();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 60_000 });

    // Server o'zgarmagan — banner yo'q.
    await page.clock.fastForward("05:01");
    await expect(banner(page)).toHaveCount(0);

    const served = await releaseNewVersion(page);
    await page.clock.fastForward("05:01");
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText("Ilovaning yangi versiyasi chiqdi.");
    await expect(banner(page)).toContainText("Ochiq formani saqlab, keyin yangilang.");
    await expect(banner(page)).toHaveCSS("position", "sticky");
    expect(served()).toBeGreaterThan(0);

    // Qayta yuklash — haqiqiy serverdan (entry yangi bo'ladi), banner yo'qoladi.
    await page.unroute(`${ORIGIN}/`);
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Yangilash" }).click()]);
    await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 60_000 });
    await expect(banner(page)).toHaveCount(0);
  });

  test("⭐ ilovaga qaytganda (visibilitychange) — shell slotida, yuqori panel ostida", async ({ page, context }) => {
    await loggedInManager(context);
    await page.clock.install();
    await page.goto("/inbox");
    const slot = page.locator('[data-shell-slot="banner"]');
    await expect(slot).toBeAttached({ timeout: 60_000 });

    await releaseNewVersion(page);
    await page.clock.fastForward("01:01");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(slot.locator("[data-update-banner]")).toBeVisible();

    const topbar = await page.locator('[data-shell-slot="topbar"]').boundingBox();
    const box = await banner(page).boundingBox();
    expect(box && topbar && box.y >= topbar.y + topbar.height - 1).toBe(true);
  });

  test.describe("telefon (390px)", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("⭐ gorizontal skroll yo'q, «Yangilash» ≥ 44px", async ({ page, context }) => {
      await loggedInManager(context);
      await page.clock.install();
      await page.goto("/inbox");
      await expect(page.locator('[data-shell-slot="banner"]')).toBeAttached({ timeout: 60_000 });

      await releaseNewVersion(page);
      await page.clock.fastForward("05:01");
      await expect(banner(page)).toBeVisible();

      const button = await page.getByRole("button", { name: "Yangilash" }).boundingBox();
      expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
});
