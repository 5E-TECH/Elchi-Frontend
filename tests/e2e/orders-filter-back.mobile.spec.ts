import { expect, test } from "@playwright/test";
import {
  CENTER_CUSTOMER,
  expectCenterFilterApplied,
  HOME_CUSTOMER,
  leaveOrders,
  mockOrdersFilterBack,
} from "./support/ordersFilterBack";

/**
 * iR4B6hcP — /orders (v2), telefon (390px): filtr varaqasida «Markazgacha» → boshqa bo'lim (pastki menyu) → brauzer
 * «Orqaga»: «Filtrlar 1», faol filtr chipi va ro'yxat mos.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: varaqada filtr → boshqa bo'lim → «Orqaga»: «Filtrlar 1», chip va ro'yxat mos", async ({ page }) => {
  const { listQueries, leaked } = await mockOrdersFilterBack(page);
  await page.goto("/orders");
  await expect(page.getByText(HOME_CUSTOMER).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(CENTER_CUSTOMER).first()).toBeVisible();

  await page.getByRole("button", { name: /^Filtrlar/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrlar" });
  await sheet.getByRole("radiogroup", { name: "Yetkazish turi" }).getByRole("radio", { name: "Markazgacha" }).click();
  await sheet.getByRole("button", { name: /Natijalarni ko'rsatish/ }).click();
  await expect(sheet).toHaveCount(0);
  await expectCenterFilterApplied(page, listQueries);

  await leaveOrders(page, page.locator("[data-shell-slot=bottomnav]").getByRole("link", { name: "Bosh sahifa" }));
  await page.goBack();
  await expectCenterFilterApplied(page, listQueries);
  expect(leaked).toEqual([]);
});
