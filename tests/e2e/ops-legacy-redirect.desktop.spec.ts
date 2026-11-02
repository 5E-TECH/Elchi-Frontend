import { expect, test } from "@playwright/test";
import { OPS_MOVED, OPS_REDIRECTS, expectOpsHub, mockOpsHub } from "./support/opsHub";

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

for (const { from, tab, to, panel } of OPS_MOVED) {
  test(`⭐ superadmin: ${from} va /ops?tab=${tab} → ${to}, vosita sahifa ichida`, async ({ page }) => {
    const { leaked } = await mockOpsHub(page, "superadmin");
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`), { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 2, name: panel })).toBeVisible({ timeout: 60_000 });

    await page.goto(`/ops?tab=${tab}`);
    await expect(page).toHaveURL(new RegExp(`${to}$`), { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 2, name: panel })).toBeVisible({ timeout: 60_000 });
    expect(leaked).toEqual([]);
  });

  test(`⭐ admin: ${to} ochiladi, lekin vosita yo'q; ${from} — 403`, async ({ page }) => {
    await mockOpsHub(page, "admin");
    await page.goto(to);
    await expect(page.locator("[data-shell-slot=content]").getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { level: 2, name: panel })).toHaveCount(0);

    await page.goto(from);
    await expect(page.getByRole("heading", { name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 60_000 });
  });
}

test("⭐ SLA va «Analitika KPI» — superadmin bosh sahifasida, «Tizim holati» da yo'q", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/");
  await page.mouse.move(800, 500);
  const heading = page.getByRole("heading", { level: 2, name: "Analitika KPI" });
  await expect(async () => {
    await page.mouse.wheel(0, 4000);
    await expect(heading).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });

  await page.goto("/ops?tab=system");
  await expectOpsHub(page, "system", "Tizim holati — xizmatlar va AI");
  await expect(page.getByRole("heading", { level: 2, name: "Analitika KPI" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Token orqali tekshirish" })).toHaveCount(0);
});

test("⭐ admin bosh sahifasida «Analitika KPI» yo'q", async ({ page }) => {
  await mockOpsHub(page, "admin");
  await page.goto("/");
  await expect(page.locator("[data-shell-slot=content]").getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(1_500);
  await expect(page.getByRole("heading", { level: 2, name: "Analitika KPI" })).toHaveCount(0);
});

test("⭐ «Orqaga» — eski yo'l tarixda qolmaydi, hubga qayta tashlamaydi", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/ops?tab=auth");
  await expectOpsHub(page, "auth", "Kirish diagnostikasi");
  await page.goto("/system-ops");
  await expectOpsHub(page, "system", "Tizim holati — xizmatlar va AI");
  await page.goBack();
  await expect(page).toHaveURL(/\/ops\?tab=auth$/);
});
