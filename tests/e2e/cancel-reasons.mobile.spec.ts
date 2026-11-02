import { expect, test } from "@playwright/test";
import { mockCancelReasons } from "./support/cancelReasons";

/** «BEKOR QILISH SABABLARI», 390px (GNWDKvmZ): kirish havolasi ko'rinadi, filtrlar ustma-ust, skroll yo'q. */
test.describe("Bekor qilish sabablari — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const language of ["uz", "ru", "en"] as const) {
    test(`⭐ ${language}: uzun yorliq va katta son sig'adi, tugma ≥ 44px`, async ({ page }) => {
      await mockCancelReasons(page, { language, long: true });
      await page.goto("/orders/cancel-reasons");
      await expect(page.locator("[data-shell-slot=content] section ul").first()).toBeVisible({ timeout: 60_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      const clipped = await page.locator("[data-shell-slot=content] section ul li").evaluateAll((items) =>
        items.filter((item) => item.scrollWidth > item.clientWidth + 1).length,
      );
      expect(clipped).toBe(0);
    });
  }

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: /orders dan ochiladi, gorizontal skroll yo'q, filtrlar ≥ 44px`, async ({ page }) => {
      const { leaked } = await mockCancelReasons(page, { theme });
      await page.goto("/orders");

      const link = page.getByRole("link", { name: "Bekor qilish sabablari" });
      await expect(link).toBeVisible({ timeout: 60_000 });
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await link.click();

      await expect(page.getByRole("list", { name: "Sabablar bo'yicha" })).toBeVisible();
      for (const name of ["Market", "Filial"]) {
        expect((await page.getByRole("combobox", { name }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(leaked).toEqual([]);
    });
  }
});
