import { expect, test, type Page } from "@playwright/test";
import { setupShellSession } from "./support/shellSession";

/**
 * rYtCRWP2 — «To'lovlar» nomlari maketdagidek (`design/kit/roles.json`, maketlar `superadmin-payments-overview`,
 * `market-cashbox-my`, `courier-cashbox-my-all`): kuryer «Kassa», market va superadmin «To'lovlar», izoh «Kassa va
 * to'lovlarni boshqarish»; «Kassadagi summa» kartasi Asosiy kassani ochadi. Karta taklif qilgan «Mening kassam» va
 * «Kassa boshqaruvi» — faqat ega qarori bilan, ekranda yo'q. Soxta backend, 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

const menu = (page: Page) => page.getByRole("navigation", { name: "Asosiy bo'limlar" });
const content = (page: Page) => page.locator("[data-shell-slot=content]");
const title = (page: Page, name: string) =>
  content(page).getByRole("heading", { level: 1, name, exact: true });

const expectNoProposedNames = async (page: Page) => {
  await expect(page.getByText("Mening kassam")).toHaveCount(0);
  await expect(page.getByText("Kassa boshqaruvi")).toHaveCount(0);
};

test("⭐ kuryer: menyuda «Kassa» → /cash-box, sarlavha «Kassa»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "courier", "Kuryer");
  await page.goto("/cash-box");
  await expect(title(page, "Kassa")).toBeVisible({ timeout: 60_000 });
  await expect(menu(page).getByRole("link", { name: "Kassa", exact: true })).toHaveAttribute(
    "href",
    "/cash-box",
  );
  await expect(menu(page).getByRole("link", { name: "To'lovlar", exact: true })).toHaveCount(0);
  await expectNoProposedNames(page);
  expect(leaked).toEqual([]);
});

test("⭐ market: menyuda «To'lovlar» → /cash-box, sarlavha «To'lovlar»", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "market", "Baraka Shop");
  await page.goto("/cash-box");
  await expect(title(page, "To'lovlar")).toBeVisible({ timeout: 60_000 });
  await expect(menu(page).getByRole("link", { name: "To'lovlar", exact: true })).toHaveAttribute(
    "href",
    "/cash-box",
  );
  await expect(menu(page).getByRole("link", { name: "Kassa", exact: true })).toHaveCount(0);
  await expectNoProposedNames(page);
  expect(leaked).toEqual([]);
});

test("⭐ superadmin: /payments — «To'lovlar» + izoh; «Kassadagi summa» Asosiy kassani ochadi", async ({
  page,
}) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Bosh admin", {
    "finance/cashbox/all-info": { mainCashboxTotal: 3_785_000 },
  });
  await page.goto("/payments");
  await expect(title(page, "To'lovlar")).toBeVisible({ timeout: 60_000 });
  await expect(content(page)).toContainText("Kassa va to'lovlarni boshqarish");
  await expect(menu(page).getByRole("link", { name: "To'lovlar", exact: true })).toHaveAttribute(
    "href",
    "/payments",
  );
  await expectNoProposedNames(page);

  const card = content(page).getByRole("link", { name: /Kassadagi summa/ });
  await expect(card).toHaveAttribute("href", "/payments/main-cashbox");
  await card.click();
  await expect(page).toHaveURL(/\/payments\/main-cashbox$/);
  await expect(title(page, "Asosiy kassa")).toBeVisible({ timeout: 60_000 });
  expect(leaked).toEqual([]);
});
