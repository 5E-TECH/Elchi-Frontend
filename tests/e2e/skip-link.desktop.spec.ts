import { expect, test, type Page } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * KI-1 · KI-S2 — «Asosiy kontentga o'tish» (maket `superadmin-orders-list-skip-link`; shell barcha sahifalarda bir xil,
 * shuning uchun soxta API bilan yengil ochiladigan `/settings` da tekshiriladi), desktop 1280.
 *
 *  - body'dan birinchi Tab — skip-link'ga (shell'ning birinchi fokuslanadigan elementi), u chap yuqorida ko'rinadi;
 *  - fokussiz — ko'rinmaydi (shaffof, ekrandan tashqarida);
 *  - Enter — fokus kontent slotiga (`#main-content`), URL o'zgarmaydi (`#hash` yo'q); keyingi Tab — kontent ichida.
 */
const skipLink = (page: Page) => page.getByRole("link", { name: "Asosiy kontentga o'tish" });

test("superadmin: Tab → «Asosiy kontentga o'tish» → Enter → kontent", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev");
  await page.goto("/settings");
  await expect(page.locator("#main-content h1")).toBeVisible();

  const link = skipLink(page);
  // Fokussiz: DOM'da bor, lekin ko'rinmaydi (opacity 0, viewport'dan yuqorida).
  await expect(link).toHaveCSS("opacity", "0");
  expect((await link.boundingBox())!.y + (await link.boundingBox())!.height).toBeLessThanOrEqual(0);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("opacity", "1");
  const box = (await link.boundingBox())!;
  // Maket: `top: 12px; left: 12px`.
  expect(Math.round(box.x)).toBe(12);
  expect(Math.round(box.y)).toBe(12);
  expect(box.height).toBeGreaterThanOrEqual(40);
  // Fokus halqasi (global `:focus-visible`, 2px action).
  await expect(link).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: "test-results/ki1-skip-link-desktop.png" });

  const urlBefore = page.url();
  await page.keyboard.press("Enter");
  const content = page.locator("#main-content");
  await expect(content).toBeFocused();
  expect(page.url()).toBe(urlBefore);
  expect(page.url()).not.toContain("#");
  await expect(content).toHaveAttribute("data-shell-slot", "content");
  await expect(link).toHaveCSS("opacity", "0");

  // Keyingi Tab — yon menyu yoki yuqori panelga emas, kontent ichiga.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#main-content")))).toBe(true);

  expect(leaked).toEqual([]);
});

test("tungi mavzuda ham skip-link ko'rinadi (ikkinchi darajali tugma)", async ({ page }) => {
  await setupShellSession(page, "superadmin", "Shodiyor Ergashev");
  await page.addInitScript(() => {
    window.localStorage.setItem("theme", "dark");
    window.localStorage.setItem("theme-version", "2");
  });
  await page.goto("/settings");
  await expect(page.locator("#main-content h1")).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  await expect(skipLink(page)).toBeFocused();
  await expect(skipLink(page)).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/ki1-skip-link-desktop-dark.png" });
});
