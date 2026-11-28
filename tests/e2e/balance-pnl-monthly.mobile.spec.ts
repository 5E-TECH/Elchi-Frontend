import { expect, test } from "@playwright/test";
import { openBalanceAnalysis } from "./support/balanceAnalysis";

/** «Oylik daromad va sof foyda», 390px (kunduzgi/tungi): boshqaruvlar ≥ 44px, gorizontal skroll yo'q, jadval — kartalar. */
test.describe.configure({ timeout: 120_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ 390px (${theme}): sig'adi, ≥ 44px, skrollsiz`, async ({ page }, testInfo) => {
    const { leaked } = await openBalanceAnalysis(page, { theme });
    const card = page.getByRole("region", { name: "Oylik daromad va sof foyda" });
    await expect(card.getByText("Jami daromad")).toBeVisible();
    for (const radio of await card.getByRole("radio").all()) {
      const box = (await radio.boundingBox())!;
      expect(box.height, await radio.innerText()).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    // Telefonda tooltip yo'q — tanlangan (sukut: joriy) oy pastdagi qatorda.
    await expect(card.getByRole("status")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await testInfo.attach(`balance-pnl-uz-${theme}-390`, { body: await card.screenshot(), contentType: "image/png" });

    await card.getByRole("radio", { name: "Jadval" }).click();
    await expect(card.getByText("joriy oy")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
}
