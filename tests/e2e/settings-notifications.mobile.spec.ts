import { expect, test } from "@playwright/test";
import { mockSettingsApi, openNotificationsTab, settingsTab } from "./support/settingsNotifications";

/** Sozlamalar → Bildirishnomalar (F89H1avs) — 390px (TC11). */
test.describe("Sozlamalar → Bildirishnomalar — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC11: tab va kalitlar bir ustunda, hech biri ekrandan chiqmaydi, gorizontal skroll yo'q", async ({ page }) => {
    const { leaked } = await mockSettingsApi(page);
    await openNotificationsTab(page);

    const switches = await page.getByRole("switch").evaluateAll((elements) =>
      elements
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { left: Math.round(r.left), right: Math.round(r.right) };
        }),
    );
    expect(switches.length).toBeGreaterThanOrEqual(8);
    for (const box of switches) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(390);
    }
    // Bir ustun: barcha kalitlar o'ng chetda bir xil vertikal chiziqda.
    const rights = new Set(switches.map((box) => box.right));
    expect(Math.max(...rights) - Math.min(...rights)).toBeLessThanOrEqual(24);

    const tab = settingsTab(page, /Bildirishnomalar/);
    const tabBox = (await tab.boundingBox())!;
    expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(390);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const mainOverflow = await page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollWidth - main.clientWidth);
    expect(mainOverflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
