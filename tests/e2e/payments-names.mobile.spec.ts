import { expect, test, type Page } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * rYtCRWP2 — 390px: kuryerda «Kassa» «Menyu» varag'ida (pastki menyuda yo'q, `roles.json` → `bottomNav`), marketda
 * «To'lovlar» pastki menyuda; superadminda «Kassadagi summa» kartasi ≥ 44px va Asosiy kassani ochadi.
 */
test.describe.configure({ timeout: 120_000 });

const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Asosiy bo'limlar" });
const content = (page: Page) => page.locator("[data-shell-slot=content]");
const title = (page: Page, name: string) =>
  content(page).getByRole("heading", { level: 1, name, exact: true });

const expectNoOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

test("⭐ kuryer: «Menyu» varag'ida «Kassa» → /cash-box, sarlavha «Kassa»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "courier", "Kuryer");
  await page.goto("/");
  await expect(bottomNav(page)).toBeVisible({ timeout: 60_000 });
  await expect(bottomNav(page).getByRole("link", { name: "Kassa", exact: true })).toHaveCount(0);

  await bottomNav(page).getByRole("button", { name: "Menyu" }).click();
  await page.getByRole("link", { name: "Kassa", exact: true }).click();
  await expect(page).toHaveURL(/\/cash-box$/);
  await expect(title(page, "Kassa")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "To'lovlar", exact: true })).toHaveCount(0);
  await expectNoOverflow(page);
  expect(leaked).toEqual([]);
});

test("⭐ market: pastki menyuda «To'lovlar» → /cash-box, sarlavha «To'lovlar»", async ({
  page,
}) => {
  const { leaked } = await setupShellSession(page, "market", "Baraka Shop");
  await page.goto("/");
  await bottomNav(page)
    .getByRole("link", { name: "To'lovlar", exact: true })
    .click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/cash-box$/);
  await expect(title(page, "To'lovlar")).toBeVisible({ timeout: 60_000 });
  await expectNoOverflow(page);
  expect(leaked).toEqual([]);
});

test("⭐ superadmin: «To'lovlar» + izoh; «Kassadagi summa» ≥ 44px, Asosiy kassani ochadi", async ({
  page,
}) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Bosh admin", {
    "finance/cashbox/all-info": { mainCashboxTotal: 3_785_000 },
  });
  await page.goto("/payments");
  await expect(title(page, "To'lovlar")).toBeVisible({ timeout: 60_000 });
  await expect(content(page)).toContainText("Kassa va to'lovlarni boshqarish");
  await expectNoOverflow(page);

  const card = content(page).getByRole("link", { name: /Kassadagi summa/ });
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await card.click();
  await expect(page).toHaveURL(/\/payments\/main-cashbox$/);
  await expect(title(page, "Asosiy kassa")).toBeVisible({ timeout: 60_000 });
  expect(leaked).toEqual([]);
});
