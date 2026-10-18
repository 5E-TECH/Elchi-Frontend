import { expect, test } from "@playwright/test";
import { mockDegradedDashboard, openDashboard } from "./support/dashboardDegraded";

/** VkwhHqvW — 390px: xato kartalari sig'adi, «Qayta urinish» ≥ 44px, gorizontal skroll yo'q. */
test.describe("Dashboard qisman nosozligi — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const [role, failedParts, testId] of [
    ["superadmin", ["topMarkets", "markets"], "ranking-markets"],
    ["market", ["topMarkets"], "market-ranking-failed"],
    ["courier", ["topCouriers"], "courier-ranking-failed"],
  ] as const) {
    test(`⭐ ${role}: xato kartasi 390px ga sig'adi, «Qayta urinish» ≥ 44px`, async ({ page }) => {
      await mockDegradedDashboard(page, { role, failedParts: [...failedParts] });
      await openDashboard(page);

      const card = page.getByTestId(testId);
      await expect(card).toContainText("Ma'lumotni yuklab bo'lmadi", { timeout: 60_000 });
      const retry = card.getByRole("button", { name: "Qayta urinish" });
      expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
