import { expect, test } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * KI-1 · KI-S2 — «Asosiy kontentga o'tish» telefonda (390): tashqi klaviatura bilan Tab — birinchi element,
 * ≥ 44px, ekrandan toshmaydi; Enter — fokus kontentga, URL o'zgarmaydi.
 */
test("390: Tab → skip-link (≥ 44px, toshmaydi) → Enter → kontent", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev");
  await page.goto("/settings");
  await expect(page.locator("#main-content h1")).toBeVisible();

  const link = page.getByRole("link", { name: "Asosiy kontentga o'tish" });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("opacity", "1");
  const box = (await link.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(page.url()).not.toContain("#");
  expect(leaked).toEqual([]);
});
