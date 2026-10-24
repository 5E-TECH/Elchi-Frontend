import { expect, test } from "@playwright/test";
import { expectNoRawPeriodKeys, openBalanceAnalysis, periodLabels, UZ_PERIODS } from "./support/balanceAnalysis";

/** SUDGlPuj — Balans → Tahlil davr filtri, 390px (kunduzgi/tungi): to'rt tugma sig'adi, ≥ 44px, gorizontal skroll yo'q. */
test.describe.configure({ timeout: 120_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ 390px (${theme}): «Bugun · Bu hafta · Bu oy · Barchasi» sig'adi, ≥ 44px, skrollsiz`, async ({ page }, testInfo) => {
    const { period, leaked } = await openBalanceAnalysis(page, { theme });
    expect(await periodLabels(page)).toEqual(UZ_PERIODS);
    for (const radio of await period.getByRole("radio").all()) {
      const box = (await radio.boundingBox())!;
      expect(box.height, await radio.innerText()).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expectNoRawPeriodKeys(page);
    await testInfo.attach(`balance-analysis-uz-${theme}-390`, { body: await page.screenshot(), contentType: "image/png" });
    expect(leaked).toEqual([]);
  });
}
