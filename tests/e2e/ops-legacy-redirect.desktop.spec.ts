import { expect, test } from "@playwright/test";
import { OPS_REDIRECTS, expectOpsHub, mockOpsHub } from "./support/opsHub";

/**
 * F2NzXpMv + bhitm9do — «ikki eshik» yopildi: `/investors-ops`, `/logistics-ops`, `/branch-ops`, `/system-ops` va `/logs`
 * alohida sahifa bo'lib ochilmaydi, faqat `/ops?tab=<k>` hub ichida (eski havola buzilmaydi). Guard o'sha — admin 403.
 * Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

for (const { from, tab, label, panel } of OPS_REDIRECTS) {
  test(`⭐ superadmin: ${from} → /ops?tab=${tab}, «${label}» tabi tanlangan`, async ({ page }) => {
    const { leaked } = await mockOpsHub(page, "superadmin");
    await page.goto(from);
    await expectOpsHub(page, tab, panel);
    await expect(page.getByRole("tab", { name: label, exact: true, selected: true })).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test(`⭐ admin: ${from} — 403, hubga o'tmaydi`, async ({ page }) => {
    await mockOpsHub(page, "admin");
    await page.goto(from);
    await expect(page.getByRole("heading", { name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { level: 1, name: "Ops vositalari" })).toHaveCount(0);
  });
}

test("⭐ «Orqaga» — eski yo'l tarixda qolmaydi, hubga qayta tashlamaydi", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/ops?tab=auth");
  await expectOpsHub(page, "auth", "Kirish diagnostikasi");
  await page.goto("/branch-ops");
  await expectOpsHub(page, "branches", "Filiallar — operatsiyalar");
  await page.goBack();
  await expect(page).toHaveURL(/\/ops\?tab=auth$/);
});
