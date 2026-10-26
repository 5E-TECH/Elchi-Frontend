import { expect, test, type Page } from "@playwright/test";
import { mockDegradedDashboard } from "./support/dashboardDegraded";

/**
 * WuVeVZqo — SPA o'tishida brauzer sarlavhasi, `<h1>`, fokus va skrin-rider e'loni. Soxta API (superadmin), 1440px.
 *   - / → /orders → /payments (yon menyu havolalari): `document.title` uch xil, «<sahifa> — Elchi Pochta»;
 *   - har o'tishdan keyin fokus kontentda (`#main-content` ichida), jonli hudud sahifa nomini aytadi;
 *   - v2 sahifalarida aynan bitta `<h1>` (PageHeader).
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 300_000 });

const pageHeading = (page: Page) => page.locator("#main-content h1").first();

const openFromSidebar = async (page: Page, link: string, path: RegExp) => {
  await page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link", { name: link, exact: true }).click();
  await expect(page).toHaveURL(path);
  await expect(pageHeading(page)).toBeVisible({ timeout: 60_000 });
};

const focusInContent = (page: Page) =>
  page.evaluate(() => Boolean(document.getElementById("main-content")?.contains(document.activeElement)));

test("⭐ / → /orders → /payments: sarlavha uch xil, fokus kontentda, o'tish e'lon qilinadi", async ({ page }) => {
  await mockDegradedDashboard(page);
  await page.goto("/");
  await expect(pageHeading(page)).toBeVisible({ timeout: 90_000 });
  const titles = [await page.title()];

  await openFromSidebar(page, "Buyurtmalar", /\/orders$/);
  await expect(page).toHaveTitle("Buyurtmalar — Elchi Pochta");
  titles.push(await page.title());
  expect(await focusInContent(page)).toBe(true);
  await expect(page.locator("#route-announcer")).toHaveText("Buyurtmalar");

  await openFromSidebar(page, "To'lovlar", /\/payments$/);
  await expect(page).toHaveTitle("To'lovlar — Elchi Pochta");
  titles.push(await page.title());
  expect(await focusInContent(page)).toBe(true);
  await expect(page.locator("#route-announcer")).toHaveText("To'lovlar");

  expect(new Set(titles).size).toBe(3);
});

const V2_PAGES = [
  "/",
  "/orders",
  "/mails/today",
  "/payments",
  "/products",
  "/all-users",
  "/regions",
  "/branches",
  "/new-orders",
  "/financial-balance",
  "/activity-logs",
  "/notifications",
];

test("⭐ v2 sahifalarida aynan bitta <h1> (PageHeader) va o'z sarlavhasi", async ({ page }) => {
  await mockDegradedDashboard(page);
  for (const path of V2_PAGES) {
    await page.goto(path);
    await expect(pageHeading(page)).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("h1"), path).toHaveCount(1);
    const heading = (await pageHeading(page).innerText()).trim();
    await expect(page, path).toHaveTitle(`${heading} — Elchi Pochta`);
  }
});
