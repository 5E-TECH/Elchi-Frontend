import { expect, test, type Page } from "@playwright/test";

/**
 * js9ndYwA — ilova kodi ishga tushmasa oq ekran emas, zaxira matn (`index.html`). Taymer YO'Q:
 *   - JavaScript o'chiq — `<noscript>` «Ilova ishlashi uchun JavaScript yoqilgan bo'lishi kerak.»;
 *   - sekin yuklanish (asosiy JS 12 s ushlab turiladi — eski 8 s taymeridan uzoq) — hech qaysi blok chiqmaydi;
 *   - bundle yuklanmadi — darhol «Ilovani yuklab bo'lmadi.» (+ «Qayta urinish», internet qaytsa o'zi qayta yuklaydi);
 *   - ES2020 sintaksisini tushunmaydigan brauzer (sinov skripti buziladi) — darhol «Brauzeringiz eskirgan.»;
 *   - oddiy yuklanish — bloklar ko'rinmaydi, ilova kodi ishga tushgach DOM'dan o'chiriladi (`main.tsx`).
 * `/login` — kirishsiz ochiladi, backend so'rovi kerak emas.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ timeout: 120_000 });

const MAIN = /\/src\/main\.tsx/;
const legacy = (page: Page) => page.locator("#legacy-fallback");
const boot = (page: Page) => page.locator("#boot-fallback");

test.describe("JavaScript o'chiq", () => {
  test.use({ javaScriptEnabled: false });

  test("⭐ zaxira matn ko'rinadi, boshqa bloklar chiqmaydi", async ({ page }) => {
    await page.goto("/login");
    // `getByText` `<noscript>` ichini qidirmaydi — CSS selektor bilan.
    const message = page.locator("noscript .elchi-fallback__title");
    await expect(message).toBeVisible();
    await expect(message).toHaveText("Ilova ishlashi uchun JavaScript yoqilgan bo'lishi kerak.");
    await expect(legacy(page)).toBeHidden();
    await expect(boot(page)).toBeHidden();
  });
});

test("⭐ sekin yuklanish — 12 s kutishda ham «Brauzeringiz eskirgan» / «yuklab bo'lmadi» chiqmaydi", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(MAIN, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/login", { waitUntil: "commit" });
  await expect(legacy(page)).toBeAttached();
  const seen: string[] = [];
  const until = Date.now() + 12_000;
  while (Date.now() < until) {
    for (const [name, locator] of [["legacy", legacy(page)], ["boot", boot(page)]] as const) {
      if (await locator.isVisible()) seen.push(name);
    }
    await page.waitForTimeout(250);
  }
  expect(seen).toEqual([]);
  release();
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 90_000 });
  await expect(legacy(page)).toHaveCount(0);
  await expect(boot(page)).toHaveCount(0);
});

test("⭐ bundle yuklanmasa — darhol «Ilovani yuklab bo'lmadi.», internet qaytsa o'zi qayta yuklanadi", async ({ page, context }) => {
  let fail = true;
  await page.route(MAIN, (route) => (fail ? route.abort() : route.continue()));
  await page.goto("/login");
  await expect(boot(page)).toBeVisible({ timeout: 5_000 });
  await expect(boot(page)).toContainText("Ilovani yuklab bo'lmadi.");
  await expect(boot(page).getByRole("link", { name: "Qayta urinish" })).toBeVisible();
  await expect(legacy(page)).toBeHidden();
  fail = false;
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 90_000 });
  await expect(boot(page)).toHaveCount(0);
});

test("⭐ «Qayta urinish» — sahifani qayta yuklaydi", async ({ page }) => {
  let fail = true;
  await page.route(MAIN, (route) => (fail ? route.abort() : route.continue()));
  await page.goto("/login");
  await expect(boot(page)).toBeVisible({ timeout: 5_000 });
  fail = false;
  await boot(page).getByRole("link", { name: "Qayta urinish" }).click();
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 90_000 });
  await expect(page).toHaveURL(/\/login$/);
});

test("⭐ ES2020 sintaksisi yo'q brauzer — darhol «Brauzeringiz eskirgan.», «yuklab bo'lmadi» emas", async ({ page }) => {
  // Eski brauzer: sinov skripti tahlil qilinmaydi, ilova moduli ham ishlamaydi.
  await page.route(/\/login$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("null ?? true", "null ?!? true");
    await route.fulfill({ response, body });
  });
  await page.route(MAIN, (route) => route.abort());
  await page.goto("/login");
  await expect(legacy(page)).toBeVisible({ timeout: 2_000 });
  await expect(legacy(page)).toContainText("Brauzeringiz eskirgan.");
  await expect(legacy(page)).toContainText("Iltimos, Safari yoki Chrome'ni yangilang.");
  await expect(boot(page)).toBeHidden();
});

test("⭐ oddiy yuklanish — bloklar ko'rinmaydi va ilova kodi ishga tushgach DOM'dan o'chiriladi", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 90_000 });
  await expect(legacy(page)).toHaveCount(0);
  await expect(boot(page)).toHaveCount(0);
});
