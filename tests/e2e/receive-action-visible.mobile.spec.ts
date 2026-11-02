import { expect, test } from "@playwright/test";
import { BATCH_PATH, expectInViewport, MARKET_PATH, mockReceiveVisible, ORDER_COUNT, receiveButton } from "./support/receiveVisible";

/**
 * ndKkHjhe — 390px: «Qabul qilish — N ta» (qisqa nom) pastki menyu ustidagi panelda (`/dispatch` naqshi) doim ko'rinadi;
 * ro'yxat oxirigacha aylantirilsa oxirgi qator panel ostida qolmaydi. Maketdagi «Kamera bilan skanerlash» sticky paneli o'rniga
 * markaziy «Skaner» tugmasi — ega qarori (AGENTS.md: «oqim ichida kamera tugmasi yo'q»).
 */
test.describe.configure({ timeout: 180_000 });

for (const [name, path] of [
  ["market yangi buyurtmalari", MARKET_PATH],
  ["filial paketi", BATCH_PATH],
] as const) {
  test(`⭐ 390 ${name}: «Qabul qilish — N ta» pastki menyu ustida, oxirgi qator panel ostida emas`, async ({ page }) => {
    await mockReceiveVisible(page);
    await page.goto(path);
    const button = receiveButton(page);
    await expect(button).toBeVisible({ timeout: 90_000 });
    // Ko'rinadigan matn (telefonda «buyurtma» so'zi CSS bilan yashirin).
    expect((await button.innerText()).trim()).toMatch(/^Qabul qilish — \d+ ta$/);
    await expectInViewport(page, button);

    const main = page.locator("main:has([data-shell-slot=content])");
    for (let i = 0; i < 6; i += 1) {
      await main.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
      await page.waitForTimeout(150);
    }
    const lastRow = page.locator("#main-content li, #main-content tbody tr").last();
    await expect(lastRow).toBeVisible();
    const rowBox = (await lastRow.boundingBox())!;
    const navBox = (await page.locator("[data-shell-slot=bottomnav]").getByRole("navigation").boundingBox())!;
    expect(navBox.y).toBeGreaterThan(400);
    expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(navBox.y + 1);
    await expectInViewport(page, button);
    const buttonBox = (await button.boundingBox())!;
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(navBox.y);
    expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(buttonBox.y);
    expect(await page.locator("#main-content li, #main-content tbody tr").count()).toBeGreaterThanOrEqual(ORDER_COUNT);
  });
}
