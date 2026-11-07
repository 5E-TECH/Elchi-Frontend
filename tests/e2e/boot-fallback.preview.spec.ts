import { expect, test, type Page } from "@playwright/test";

/**
 * js9ndYwA — PROD BUILD: asosiy JS head'da, statik importlar `modulepreload` bilan. Sekin tarmoqda (asosiy JS 12 s
 * ushlab turiladi) hech qaysi zaxira blok chiqmaydi; statik import (vendor-react) yuklanmasa — «Ilovani yuklab
 * bo'lmadi.», «eskirgan» emas.
 */
const MAIN_JS = /\/assets\/index-[^/]+\.js$/;
const blockApi = (page: Page) =>
  page.context().route(/api\.elchipochta\.uz|:3004\//, (route) => route.abort());

test("⭐ prod: asosiy JS 12 s kechiksa — zaxira bloklar ko'rinmaydi, keyin forma", async ({ page }) => {
  await blockApi(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(MAIN_JS, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/login", { waitUntil: "commit" });
  const seen: string[] = [];
  const until = Date.now() + 12_000;
  while (Date.now() < until) {
    for (const id of ["legacy-fallback", "boot-fallback"]) {
      if (await page.locator(`#${id}`).isVisible()) seen.push(id);
    }
    await page.waitForTimeout(250);
  }
  expect(seen).toEqual([]);
  // Birinchi kadr (logotip) shu vaqt davomida ko'rinib turadi.
  await expect(page.locator("#login-shell img")).toBeVisible();
  release();
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#legacy-fallback, #boot-fallback")).toHaveCount(0);
});

test("⭐ prod: statik import (modulepreload) yuklanmasa — «Ilovani yuklab bo'lmadi.»", async ({ page }) => {
  await blockApi(page);
  await page.route(/\/assets\/vendor-react-[^/]+\.js$/, (route) => route.abort());
  await page.goto("/login");
  await expect(page.locator("#boot-fallback")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#boot-fallback")).toContainText("Ilovani yuklab bo'lmadi.");
  await expect(page.locator("#legacy-fallback")).toBeHidden();
});
