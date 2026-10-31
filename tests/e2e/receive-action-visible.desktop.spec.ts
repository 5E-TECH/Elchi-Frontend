import { expect, test } from "@playwright/test";
import { BATCH_PATH, expectInViewport, MARKET_PATH, mockReceiveVisible, ORDER_COUNT, receiveButton } from "./support/receiveVisible";

/**
 * ndKkHjhe — 1440×900: «Qabul qilish — N ta buyurtma» sahifa sarlavhasi amallarida (maket
 * superadmin-neworders-market-orders, superadmin-neworders-branch-batch-detail) — 50 ta qatorda ham ochilgan
 * zahoti skrollsiz ko'rinadi. Avval tugma ro'yxat oxirida edi (~3 ekran pastda). Sarlavha yopishqoq — oxirigacha
 * skrollda ham tugma ekranda qoladi.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

for (const [name, path] of [
  ["market yangi buyurtmalari", MARKET_PATH],
  ["filial paketi", BATCH_PATH],
] as const) {
  test(`⭐ ${name}: ${ORDER_COUNT} ta qatorda «Qabul qilish — N ta buyurtma» sarlavhada, skrollsiz ko'rinadi`, async ({ page }) => {
    await mockReceiveVisible(page);
    await page.goto(path);
    const button = receiveButton(page);
    await expect(button).toBeVisible({ timeout: 90_000 });
    await expect(button).toHaveText(/^Qabul qilish — \d+ ta buyurtma$/);
    // Ro'yxat haqiqatan uzun — tugma ro'yxat oxirida emas, sahifa boshida.
    const scroll = await page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollHeight - main.clientHeight);
    expect(scroll).toBeGreaterThan(900);
    await expectInViewport(page, button);

    await page
      .locator("main:has([data-shell-slot=content])")
      .evaluate((main) => main.scrollTo({ top: main.scrollHeight }));
    await expectInViewport(page, button);
  });
}
