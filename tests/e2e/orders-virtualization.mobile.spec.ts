import { expect, test } from "@playwright/test";
import { domNodeCount, expectNoHorizontalOverflow, mockHundredOrders, orderRef, scrollShellToBottom } from "./support/ordersVirtual";

/**
 * F4RSPBwx — /orders?limit=100 telefonda (390px, kartalar): faqat ko'rinadigan kartalar DOM'da (avval ~5 700 tugun),
 * pastga aylantirilsa 100-buyurtma ko'rinadi, ekran o'quvchiga umumiy son (`aria-setsize`).
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390 limit=100: DOM ≤ 2 000 tugun, 100-chi karta skrollda ko'rinadi", async ({ page }) => {
  await mockHundredOrders(page);
  await page.goto("/orders?limit=100");
  await expect(page.getByText(orderRef(1)).first()).toBeVisible({ timeout: 90_000 });

  expect(await domNodeCount(page)).toBeLessThanOrEqual(2000);
  const firstCard = page.locator("li[data-index='0']");
  await expect(firstCard).toHaveAttribute("aria-setsize", "100");
  await expect(page.getByText(orderRef(100))).toHaveCount(0);

  await scrollShellToBottom(page);
  await expect(page.getByText(orderRef(100)).first()).toBeVisible();
  await expect(page.locator("li[data-index='99']")).toHaveAttribute("aria-posinset", "100");
  expect(await domNodeCount(page)).toBeLessThanOrEqual(2000);
  await expectNoHorizontalOverflow(page);
});
