import { expect, test } from "@playwright/test";
import { expectDarkContrast, openDarkPage } from "./support/darkContrast";
import { PAYMENTS_HANDLERS } from "./support/darkContrastData";

/**
 * xYWDHMTi «447ec1»: tungi mavzuda `/payments` va `/settings` dagi har ko'rinadigan matn ≥ 4.5:1 (1440px).
 * Avval binafsha `main` matn rangi tungi yuzada 2.05–2.95:1 berardi.
 */
test.describe("Tungi mavzu kontrasti — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("/payments: barcha matn ≥ 4.5:1", async ({ page }) => {
    const { leaked } = await openDarkPage(page, "/payments", PAYMENTS_HANDLERS);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Oktabr hisob-kitobi").first()).toBeVisible();
    await expectDarkContrast(page, { minElements: 25 });
    expect(leaked).toEqual([]);
  });

  test("/settings: har bo'lim matni ≥ 4.5:1", async ({ page }) => {
    const { leaked } = await openDarkPage(page, "/settings");
    const tabs = page.getByRole("main").getByRole("tab");
    await expect(tabs.first()).toBeVisible({ timeout: 60_000 });
    const count = await tabs.count();
    expect(count).toBeGreaterThan(2);
    for (let index = 0; index < count; index += 1) {
      await tabs.nth(index).click();
      await expectDarkContrast(page);
    }
    expect(leaked).toEqual([]);
  });
});
