import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, mockInvestorHome } from "./support/investorHome";

/**
 * vpKijXce — 390px: kabinet nazorati gorizontal skrollsiz (kunduzgi, tungi). LIuf0DcD (ega 2026-11-18): Ops
 * «Investorlar» ro'yxati («Kabinetni ko'rish») olib tashlandi — kabinet `/investor/:id` dan ochiladi.
 */
test.describe.configure({ timeout: 120_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ ${theme}: kabinet nazorati, skroll yo'q`, async ({ page }) => {
    const mock = await mockInvestorHome(page, { role: "superadmin", theme });
    await page.goto("/investor/7");

    await expect(page.getByRole("heading", { level: 1, name: "Investor kabineti · Habibulla Nazirov" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Nazorat · faqat o'qish")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(mock.control).toContain("7:12");
    expect(mock.leaked).toEqual([]);
  });
}
