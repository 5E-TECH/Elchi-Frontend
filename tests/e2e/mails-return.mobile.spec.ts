import { expect, test } from "@playwright/test";
import { mockReturnApi, openReturnTab } from "./support/mailsReturn";

/** Pochta → Qaytarish (YEI06cPN) — 390px. */
test.describe("Pochta → Qaytarish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("guruh, qatorlar va Tasdiqlash/Rad etish tugmalari ekranga sig'adi; tasdiqlash ishlaydi", async ({ page }) => {
    const { actions, leaked } = await mockReturnApi(page);
    await openReturnTab(page);

    for (const name of ["Tasdiqlash", "Rad etish"]) {
      const button = page.getByRole("button", { name }).first();
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(390);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.locator("label").filter({ hasText: "Karimova Nodira" }).locator('input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: "Tasdiqlash" }).first().click();
    await expect(page.getByText("Karimova Nodira")).toHaveCount(0);
    expect(actions[0]?.body).toEqual({ order_ids: ["1251171"] });
    expect(leaked).toEqual([]);
  });
});
