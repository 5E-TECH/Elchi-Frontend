import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, mockInvestorHome } from "./support/investorHome";

/** vpKijXce — 390px: Ops ro'yxatida «Kabinetni ko'rish» ≥ 44px, kabinet nazorati gorizontal skrollsiz (kunduzgi, tungi). */
test.describe.configure({ timeout: 120_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ ${theme}: kartadan kabinetga, skroll yo'q, tugma ≥ 44px`, async ({ page }) => {
    const mock = await mockInvestorHome(page, { role: "superadmin", theme });
    await page.goto("/ops?tab=investors");

    const open = page.getByRole("link", { name: "Habibulla Nazirov — kabinetni ko'rish" });
    await expect(open).toBeVisible({ timeout: 90_000 });
    expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
    await open.click();

    await expect(page.getByRole("heading", { level: 1, name: "Investor kabineti · Habibulla Nazirov" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Nazorat · faqat o'qish")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(mock.control).toContain("7:12");
    expect(mock.leaked).toEqual([]);
  });
}
