import { expect, test } from "@playwright/test";
import { RAW_BACKEND_MESSAGE, expectNoHorizontalOverflow, mockInvestorHome } from "./support/investorHome";

/**
 * vpKijXce — superadmin investor kabinetini nazorat uchun ko'radi (1440px): `/investor/7`; ma'lumot
 * `GET investors/7/dashboard` dan, `investors/me/*` so'ralmaydi, hech narsa yozilmaydi. LIuf0DcD (ega 2026-11-18): Ops
 * «Investorlar» tabi olib tashlandi — `/investor` va «← Investorlar» «Foydalanuvchilar → Investorlar» ga olib boradi.
 */
test.describe.configure({ timeout: 120_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test("⭐ kabinet nazorati: KPI, oylik foyda, «Nazorat»; davr almashadi; «← Investorlar» — Foydalanuvchilar", async ({ page }) => {
  const mock = await mockInvestorHome(page, { role: "superadmin" });
  await page.goto("/investor");
  await expect(page).toHaveURL(/\/all-users\?role=investor$/, { timeout: 90_000 });
  await expect(page.getByRole("tab", { name: "Investorlar", exact: true, selected: true })).toBeVisible({ timeout: 60_000 });

  await page.goto("/investor/7");
  await expect(page.getByRole("heading", { level: 1, name: "Investor kabineti · Habibulla Nazirov" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Nazorat", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Asosiy ko'rsatkichlar" })).toContainText("Mening investitsiyam");
  await expect(page.getByText("Investitsiyalar va foyda tarixi ro'yxati faqat investorning o'z kabinetida ko'rinadi.")).toBeVisible();
  // Ega 2026-11-28: «Ulush shartlari» — joriy ulush, asos, investorlik sanasi va tarix.
  const terms = page.getByRole("region", { name: "Ulush shartlari" });
  await expect(terms.getByText("Investorlik sanasi")).toBeVisible();
  await expect(terms.getByRole("table", { name: "Shartlar tarixi" }).getByRole("row")).toHaveCount(3);
  await expect(terms.getByRole("button", { name: "Shartni o'zgartirish" })).toBeVisible();

  await page.getByRole("radio", { name: "24 oy" }).click();
  await expect.poll(() => mock.control.at(-1)).toBe("7:24");
  expect(mock.control[0]).toBe("7:12");
  expect(mock.requested.some((path) => path.startsWith("investors/me"))).toBe(false);
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);

  await page.getByRole("link", { name: "Investorlar" }).first().click();
  await expect(page).toHaveURL(/\/all-users\?role=investor$/);
});

test("⭐ investor topilmasa (404) — «Investor topilmadi», «Chiqish» yo'q, xom matn yo'q", async ({ page }) => {
  await mockInvestorHome(page, { role: "superadmin", status: 404 });
  await page.goto("/investor/7");

  await expect(page.getByText("Investor topilmadi")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Chiqish" })).toHaveCount(0);
  await expect(page.getByText(RAW_BACKEND_MESSAGE)).toHaveCount(0);
});

test("⭐ investor o'zi: /investor → o'z kabineti, boshqaning kabineti — 403", async ({ page }) => {
  const mock = await mockInvestorHome(page);
  await page.goto("/investor");
  await expect(page).toHaveURL(/\/$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeVisible({ timeout: 90_000 });

  await page.goto("/investor/7");
  await expect(page.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 60_000 });
  expect(mock.control).toEqual([]);
});

test("admin: /investor/7 — 403, so'rov ketmaydi", async ({ page }) => {
  const mock = await mockInvestorHome(page, { role: "admin" });
  await page.goto("/investor/7");

  await expect(page.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 90_000 });
  expect(mock.control).toEqual([]);
});
