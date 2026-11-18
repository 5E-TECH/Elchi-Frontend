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

/** LIuf0DcD, F2qp6FtE — 390px: «Ops bo'limi» ro'yxatida 4 ta bo'lim, olib tashlanganlari yo'q. */
test("⭐ «Ops bo'limi» ro'yxatida 4 ta bo'lim (LIuf0DcD, F2qp6FtE)", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/ops?tab=system");
  await expectOpsHub(page, "system", "Tizim holati — xizmatlar va AI");
  await page.getByRole("combobox", { name: "Ops bo'limi: Tizim holati" }).click();
  const options = page.getByRole("option");
  await expect(options).toHaveText(["Xarajat kategoriyalari", "Kassa smenasi", "Kun tartibi", "Tizim holati"]);
});
