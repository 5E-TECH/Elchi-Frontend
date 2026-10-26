import { expect, test, type Page } from "@playwright/test";
import { domNodeCount, expectNoHorizontalOverflow, mockHundredOrders, orderRef, scrollShellToBottom } from "./support/ordersVirtual";

/**
 * F4RSPBwx — /orders?limit=100 (1440px): jadval virtualizatsiya qilinadi — DOM tugunlari ≤ 2 000 (avval ~7 100),
 * qator balandligi virtualizatsiyasiz jadvaldagidek, pastga aylantirilsa 100-buyurtma ko'rinadi, ekran o'quvchiga
 * umumiy son.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

const rowHeight = async (page: Page) =>
  Math.round((await page.getByRole("table").locator("tbody tr:not([aria-hidden])").first().boundingBox())!.height);

test("⭐ limit=100: DOM ≤ 2 000 tugun, qator balandligi o'zgarmaydi, 100-buyurtma skrollda ko'rinadi", async ({ page }) => {
  await mockHundredOrders(page);
  const table = page.getByRole("table");
  // Virtualizatsiyasiz (10 qator) — qator balandligi namunasi.
  await page.goto("/orders?limit=10");
  await expect(table.getByRole("link", { name: `№${orderRef(1)}` })).toBeVisible({ timeout: 90_000 });
  await expect(table).not.toHaveAttribute("aria-rowcount");
  const plainHeight = await rowHeight(page);

  await page.goto("/orders?limit=100");
  await expect(table.getByRole("link", { name: `№${orderRef(1)}` })).toBeVisible({ timeout: 90_000 });

  expect(await domNodeCount(page)).toBeLessThanOrEqual(2000);
  await expect(table).toHaveAttribute("aria-rowcount", "101");
  await expect(table.locator("tbody tr[data-index='0']")).toBeVisible();
  expect(await rowHeight(page)).toBe(plainHeight);
  await expect(table.getByRole("link", { name: `№${orderRef(100)}` })).toHaveCount(0);

  await scrollShellToBottom(page);
  await expect(table.getByRole("link", { name: `№${orderRef(100)}` })).toBeVisible();
  await expect(table.locator("tbody tr[data-index='99']")).toHaveAttribute("aria-rowindex", "101");
  await expect(table.getByRole("link", { name: `№${orderRef(1)}` })).toHaveCount(0);
  expect(await domNodeCount(page)).toBeLessThanOrEqual(2000);
  await expectNoHorizontalOverflow(page);
});
