import { expect, test } from "@playwright/test";
import { mockCourierHold } from "./support/courierHold";

/**
 * «KURYERDAGI BUYURTMALAR», telefon (onXzDc5n): kuryer /orders sarlavhasidagi havola orqali kiradi; kartalar
 * sig'adi (gorizontal skroll yo'q), tugmalar ≥ 44px; ru / en va tungi mavzuda ham.
 */
test.describe("Kuryerdagi buyurtmalar — telefon", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: kuryer /orders dan ochadi, «48 soatga yaqin» kartasi, skroll yo'q`, async ({ page }) => {
      const { leaked, listQueries } = await mockCourierHold(page, { role: "courier", theme });
      await page.goto("/orders");

      const link = page.getByRole("link", { name: "Kuryerdagi buyurtmalar" }).first();
      await expect(link).toBeVisible({ timeout: 60_000 });
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await link.click();
      await expect(page).toHaveURL(/\/courier-hold$/);

      await page.getByRole("tab", { name: /48 soatga yaqin/ }).click();
      await expect.poll(() => listQueries.at(-1)?.get("courier_hold")).toBe("near_48");
      const cards = page.getByRole("list", { name: "Kuryerdagi buyurtmalar" });
      await expect(cards).toContainText("40 soat");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(leaked).toEqual([]);
    });
  }

  for (const language of ["ru", "en"] as const) {
    test(`⭐ ${language}: admin «Kuryerlar bo'yicha» kartalari sig'adi, «Buyurtmalari» ≥ 44px`, async ({ page }) => {
      await mockCourierHold(page, { role: "admin", language });
      await page.goto("/courier-hold?tab=couriers");
      const open = page.getByTestId("courier-hold-open-27");
      await expect(open).toBeVisible({ timeout: 60_000 });
      expect((await open.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      const clipped = await page
        .locator("[data-shell-slot=content] section li")
        .evaluateAll((items) => items.filter((item) => item.scrollWidth > item.clientWidth + 1).length);
      expect(clipped).toBe(0);
    });
  }
});
