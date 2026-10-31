import { expect, test } from "@playwright/test";
import { OPS_REDIRECTS, expectOpsHub, mockOpsHub } from "./support/opsHub";

/** F2NzXpMv + bhitm9do — 390px: eski yo'l `/ops?tab=<k>` ga o'tadi, bo'lim `Select` da tanlangan, gorizontal skroll yo'q. */
test.describe.configure({ timeout: 120_000 });

for (const { from, tab, label, panel } of OPS_REDIRECTS) {
  test(`⭐ ${from} → /ops?tab=${tab}, «${label}» bo'limi`, async ({ page }) => {
    const { leaked } = await mockOpsHub(page, "superadmin");
    await page.goto(from);
    await expectOpsHub(page, tab, panel);
    await expect(page.getByRole("combobox", { name: `Ops bo'limi: ${label}` })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(leaked).toEqual([]);
  });
}
