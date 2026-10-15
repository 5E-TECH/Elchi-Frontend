import { expect, test } from "@playwright/test";
import { mockBranchListApi, openBranchList } from "./support/branchList";

/** Filiallar ro'yxati — 390px: karta rejimida 2-sahifa yetib boriladi, skroll yo'q. */
test.describe("Filiallar ro'yxati — sahifalash, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("karta: 2-sahifa tugmasi ekranda, bosilganda HQ Toshkent", async ({ page }) => {
    const { leaked } = await mockBranchListApi(page, "card");
    await openBranchList(page);
    await expect(page.getByText("1-8 dan 13 tasi ko'rsatilmoqda")).toBeVisible();

    const second = page.locator("button").filter({ hasText: /^2$/ });
    await second.scrollIntoViewIfNeeded();
    const box = (await second.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await second.click();
    await expect(page.getByText("9-13 dan 13 tasi ko'rsatilmoqda")).toBeVisible();
    await expect(page.getByText("HQ Toshkent").first()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
