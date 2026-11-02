import { expect, test, type Page } from "@playwright/test";

/**
 * `/login` BIRINCHI KADRI (rzzxMItN) — PROD BUILD. Navy tasma va logotip `index.html` dagi `#login-shell` dan keladi,
 * JS'ni kutmaydi. Testda asosiy JS ushlab turiladi (sekin tarmoq holati), so'ng qo'yib yuboriladi:
 *   - logotip React sahifasidagi bilan bir joyda — almashganda sakramaydi;
 *   - tasma rangi — o'sha token (kunduzgi va tungi);
 *   - shell va forma bitta kadrda almashadi: oq bo'sh kadr yo'q;
 *   - boshqa yo'llarda shell ko'rinmaydi.
 */
const MAIN_JS = /\/assets\/index-[^/]+\.js$/;

const holdMainJs = async (page: Page) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(MAIN_JS, async (route) => {
    await held;
    await route.continue();
  });
  return release;
};

const blockApi = (page: Page) =>
  page.context().route(/api\.elchipochta\.uz|:3004\//, (route) => route.abort());

const roundedBox = async (locator: ReturnType<Page["locator"]>) => {
  const box = (await locator.boundingBox())!;
  return { x: Math.round(box.x), y: Math.round(box.y), width: box.width, height: box.height };
};

const background = (locator: ReturnType<Page["locator"]>) =>
  locator.evaluate((node) => getComputedStyle(node).backgroundColor);

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 390, height: 664 },
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1023, height: 768 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test.describe.configure({ timeout: 180_000 });

for (const viewport of VIEWPORTS) {
  test(`⭐ ${viewport.width}×${viewport.height}: logotip JS'siz chiziladi va almashganda sakramaydi`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await blockApi(page);
    const release = await holdMainJs(page);
    await page.goto("/login", { waitUntil: "commit" });

    const shellLogo = page.locator("#login-shell img");
    await expect(shellLogo).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(() => shellLogo.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0);
    const before = await roundedBox(shellLogo);

    release();
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#login-shell")).toHaveCount(0);
    const after = await roundedBox(page.locator("img:visible").first());
    expect(before).toEqual(after);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`⭐ ${theme}: tasma rangi sahifa bilan bir xil`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await blockApi(page);
    await page.addInitScript((value) => {
      window.localStorage.setItem("theme-version", "2");
      window.localStorage.setItem("theme", value);
    }, theme);
    const release = await holdMainJs(page);
    await page.goto("/login", { waitUntil: "commit" });

    const brand = page.locator(".login-shell__brand");
    await expect(brand).toBeVisible({ timeout: 60_000 });
    const before = await background(brand);

    release();
    await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 60_000 });
    const realBand = page.locator("img:visible").first().locator("xpath=..");
    expect(before).toBe(await background(realBand));
  });
}

test("⭐ shell va forma bitta kadrda almashadi — oq bo'sh kadr yo'q", async ({ page }) => {
  await blockApi(page);
  await page.addInitScript(() => {
    const state = { blank: 0 };
    (window as unknown as { __shell: typeof state }).__shell = state;
    new MutationObserver(() => {
      const root = document.getElementById("root");
      if (root && !root.querySelector("#login-shell") && !root.querySelector("form")) state.blank++;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/login");
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 60_000 });
  const { blank } = await page.evaluate(
    () => (window as unknown as { __shell: { blank: number } }).__shell,
  );
  expect(blank).toBe(0);
});

for (const path of ["/", "/orders", "/login-eski"]) {
  test(`⭐ ${path}: shell ko'rinmaydi`, async ({ page }) => {
    await blockApi(page);
    await holdMainJs(page);
    await page.goto(path, { waitUntil: "commit" });
    // Avval DOM'da: yo'q element ham «yashirin» hisoblanadi, tekshiruv bo'sh o'tardi.
    const shell = page.locator("#login-shell");
    await expect(shell).toBeAttached({ timeout: 60_000 });
    await expect(shell).toBeHidden();
  });
}
