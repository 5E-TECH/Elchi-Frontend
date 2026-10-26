import { expect, test } from "@playwright/test";
import { mockStatusCountsApi } from "./support/ordersStatusCounts";

/**
 * GaBIPi3Z — 390px (kunduzgi / tungi): `/orders` tablari sonlari (aylanadi, gorizontal skroll yo'q), pastki menyu
 * «Qabul» katagida son (taxta `tizim-states-navigation` 06 · 4: ikonka burchagida, «Qabul, 7 ta yangi»).
 */

const norm = (text: string) => text.replace(/[\s\u00a0\u202f]+/g, " ").trim();

test.describe("Buyurtmalar — holat tablari sonlari (390)", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ admin (${theme}): tablar sonli, pastki menyu «Qabul 7», skrollsiz`, async ({ page }, testInfo) => {
      const { leaked } = await mockStatusCountsApi(page, "admin", { theme });
      await page.goto("/orders");
      await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });

      const tabs = page.getByRole("tablist", { name: "Holat bo'yicha" });
      await expect.poll(async () => norm(await tabs.getByRole("tab").first().innerText())).toBe("Barchasi 1 248");
      await expect(tabs.getByRole("tab", { name: /^Bekor qilingan/ })).toContainText("0");

      const bottom = page.locator("[data-bottomnav]");
      const intake = bottom.getByRole("link", { name: "Qabul, 7 ta yangi" });
      await expect(intake).toBeVisible();
      const badge = intake.locator("[data-bottomnav-count]");
      await expect(badge).toHaveText("7");
      // Belgi katak ichida va ekran chetidan chiqmaydi; yorliq bitta qatorda.
      const badgeBox = (await badge.boundingBox())!;
      const cellBox = (await intake.boundingBox())!;
      expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(cellBox.x + cellBox.width + 1);
      expect(badgeBox.y).toBeGreaterThanOrEqual(cellBox.y - 1);
      expect(cellBox.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

      await testInfo.attach(`orders-status-counts-${theme}-390`, { body: await page.screenshot(), contentType: "image/png" });
      expect(leaked).toEqual([]);
    });
  }

  test("market: «Yaratish» katagida son", async ({ page }) => {
    await mockStatusCountsApi(page, "market");
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-bottomnav]").getByRole("link", { name: "Yaratish, 7 ta yangi" })).toBeVisible();
  });
});
