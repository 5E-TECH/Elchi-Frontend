import { expect, test } from "@playwright/test";
import { mockExtraCostApprovals, openMarketDashboard } from "./support/extraCostApprovals";

/** PINtZcLj — 390px: ro'yxat chiziq bilan, tugmalar ≥ 44px va yonma-yon, gorizontal skroll yo'q. */
test.describe("Qo'shimcha xarajat tasdiqlari — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ «Tasdiqlash / Rad etish» ≥ 44px, karta 390px ga sig'adi", async ({ page }) => {
    await mockExtraCostApprovals(page);
    await openMarketDashboard(page);

    const item = page.getByTestId("extra-cost-approvals").getByRole("listitem").first();
    for (const name of ["Tasdiqlash", "Rad etish"]) {
      const box = (await item.getByRole("button", { name }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    expect((await item.getByRole("link", { name: "№10225" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
