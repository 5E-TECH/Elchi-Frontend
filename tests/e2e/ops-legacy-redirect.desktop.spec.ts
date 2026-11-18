import { expect, test } from "@playwright/test";
import { OPS_MOVED, OPS_REDIRECTS, OPS_REMOVED, expectOpsHub, mockOpsHub, urlPattern } from "./support/opsHub";

/**
 * F2NzXpMv + bhitm9do — «ikki eshik» yopildi: `/logistics-ops`, `/branch-ops`, `/system-ops` alohida sahifa bo'lib
 * ochilmaydi, faqat `/ops?tab=<k>` hub ichida (eski havola buzilmaydi). Guard o'sha — admin 403.
 * u5HTJtqK: `/logistics-ops` va `/ops?tab=logistics` — «Pochta → Qaytarish» (`/mails/return`) ga; `/returns` da
 * qaytarish so'rovlari nusxasi yo'q. LIuf0DcD: «Kirish diagnostikasi», «Xodimlar», «Investorlar», «Yetkazish narxi»
 * olib tashlandi — eski yo'l va `?tab=` o'rnini bosuvchi sahifaga. Soxta backend, 1440px.
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

for (const { from, tab, to, heading } of OPS_REMOVED) {
  test(`⭐ superadmin: ${from ? `${from} va ` : ""}/ops?tab=${tab} → ${to} (LIuf0DcD), hub emas`, async ({ page }) => {
    const { leaked } = await mockOpsHub(page, "superadmin");
    const content = page.locator("[data-shell-slot=content]");
    for (const start of [...(from ? [from] : []), `/ops?tab=${tab}`]) {
      await page.goto(start);
      await expect(page, start).toHaveURL(urlPattern(to), { timeout: 60_000 });
      await expect(content.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 60_000 });
      await expect(content.getByRole("heading", { level: 1, name: "Ops vositalari" })).toHaveCount(0);
    }
    // «Narx kalkulyatori» namunasi — hisoblash so'rovi (POST, lekin hech narsa yozmaydi).
    expect(leaked.filter((call) => call !== "POST delivery/quote/by-tariff")).toEqual([]);
  });

  if (from) {
    test(`⭐ admin: ${from} — 403 (guard o'sha)`, async ({ page }) => {
      await mockOpsHub(page, "admin");
      await page.goto(from);
      await expect(page.getByRole("heading", { name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 60_000 });
    });
  }
}

test("⭐ superadmin: hub'da 4 ta tab — olib tashlanganlari yo'q (LIuf0DcD, F2qp6FtE)", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/ops?tab=system");
  await expectOpsHub(page, "system", "Tizim holati — xizmatlar va AI");
  const tabs = page.getByRole("tablist", { name: "Ops bo'limlari" }).getByRole("tab");
  await expect(tabs).toHaveCount(4);
  for (const removed of ["Investorlar", "Yetkazish narxi", "Xodimlar", "Kirish diagnostikasi", "Moliya operatorlari"]) {
    await expect(tabs.filter({ hasText: removed })).toHaveCount(0);
  }
});

test("⭐ superadmin: /investors-ops → «Foydalanuvchilar», «Investorlar» tabi tanlangan", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/investors-ops");
  await expect(page).toHaveURL(/\/all-users\?role=investor$/, { timeout: 60_000 });
  await expect(page.getByRole("tab", { name: "Investorlar", exact: true, selected: true })).toBeVisible({ timeout: 60_000 });
});

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

test("⭐ superadmin: /logistics-ops va /ops?tab=logistics → /mails/return (u5HTJtqK), /returns da nusxa yo'q", async ({
  page,
}) => {
  const { leaked } = await mockOpsHub(page, "superadmin");
  // «Pochta» qobig'ining kartasi — joriy tab nomi bilan (`section[aria-label]`).
  const returnTab = page.getByRole("region", { name: "Qaytarish so'rovlari", exact: true });
  await page.goto("/logistics-ops");
  await expect(page).toHaveURL(/\/mails\/return$/, { timeout: 60_000 });
  await expect(returnTab).toBeVisible({ timeout: 60_000 });

  await page.goto("/ops?tab=logistics");
  await expect(page).toHaveURL(/\/mails\/return$/, { timeout: 60_000 });
  await expect(returnTab).toBeVisible({ timeout: 60_000 });

  await page.goto("/returns");
  await expect(page.locator("[data-shell-slot=content]").getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("heading", { level: 2, name: "Logistika — qaytarish so'rovlari" })).toHaveCount(0);
  expect(leaked).toEqual([]);
});

test("⭐ admin: /logistics-ops — 403 (guard o'sha), «Pochta → Qaytarish» esa ochiladi", async ({ page }) => {
  await mockOpsHub(page, "admin");
  await page.goto("/logistics-ops");
  await expect(page.getByRole("heading", { name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 60_000 });
  await page.goto("/mails/return");
  await expect(page.getByRole("region", { name: "Qaytarish so'rovlari", exact: true })).toBeVisible({ timeout: 60_000 });
});

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
  await page.goto("/ops?tab=expense-categories");
  await expectOpsHub(page, "expense-categories", "Kassa xarajatlari kategoriyalari");
  await page.goto("/system-ops");
  await expectOpsHub(page, "system", "Tizim holati — xizmatlar va AI");
  await page.goBack();
  await expect(page).toHaveURL(/\/ops\?tab=expense-categories$/);
});
