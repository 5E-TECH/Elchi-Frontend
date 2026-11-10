import { expect, test } from "@playwright/test";
import { openCancelledTabs } from "./support/cancelledHandedTabs";

/**
 * «Bekor qilinganlar» ichki tablari — telefon (390px): tablar to'liq enda teng, sahifada gorizontal skroll yo'q,
 * «Topshirilgan» kartalari bir ustunda.
 */
test.describe("Bekor qilinganlar — Kutilmoqda | Topshirilgan, telefon", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ tablar teng, gorizontal skroll yo'q, kartalar bir ustunda", async ({ page }) => {
    const requests = await openCancelledTabs(page);
    await page.goto("/new-orders/cancelled?tab=handed");

    const tabs = page.getByRole("radiogroup", { name: "Bekor qilinganlar bo'limlari" });
    const pending = tabs.getByRole("radio", { name: /Kutilmoqda/ });
    const handed = tabs.getByRole("radio", { name: /Topshirilgan/ });
    await expect(handed).toHaveText("Topshirilgan2", { timeout: 90_000 });
    const [a, b] = [await pending.boundingBox(), await handed.boundingBox()];
    expect(a!.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);

    const card = page.getByRole("region", { name: "Marketga topshirilgan bekor qilinganlar" });
    const links = card.getByRole("link", { name: /Baraka Shop|Nur Market/ });
    await expect(links).toHaveCount(2);
    const [first, second] = [await links.nth(0).boundingBox(), await links.nth(1).boundingBox()];
    expect(Math.abs(first!.x - second!.x)).toBeLessThan(1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await pending.click();
    await expect(page).toHaveURL(/\/new-orders\/cancelled$/);
    await expect(page.getByRole("link", { name: /Baraka Shop/ }).first()).toBeVisible();
    expect(requests.leaked).toEqual([]);
  });
});
