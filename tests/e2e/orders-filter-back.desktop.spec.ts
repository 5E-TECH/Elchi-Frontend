import { expect, test } from "@playwright/test";
import {
  CENTER_CUSTOMER,
  expectCenterFilterApplied,
  HOME_CUSTOMER,
  leaveOrders,
  mockOrdersFilterBack,
} from "./support/ordersFilterBack";

/**
 * iR4B6hcP — /orders (v2): filtr qo'yib boshqa bo'limga o'tib, brauzer «Orqaga» bosilganda «Filtrlar N» soni,
 * faol filtr chiplari va ro'yxat mazmuni mos (yo'l o'zgarganda Redux tozalanadi, filtr URL'dan tiklanadi). 1440px.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ filtr → boshqa bo'lim → «Orqaga»: «Filtrlar 1», chip va ro'yxat mos", async ({ page }) => {
  const { listQueries, leaked } = await mockOrdersFilterBack(page);
  await page.goto("/orders");
  await expect(page.getByText(HOME_CUSTOMER).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(CENTER_CUSTOMER).first()).toBeVisible();

  await page.getByRole("button", { name: /^Filtrlar/ }).click();
  await page.getByRole("group", { name: "Qo'shimcha filtrlar" }).getByRole("combobox", { name: "Yetkazish turi" }).click();
  await page.getByRole("option", { name: "Markazgacha" }).click();
  await expectCenterFilterApplied(page, listQueries);

  await leaveOrders(page, page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link", { name: "Pochta" }));
  await page.goBack();
  await expectCenterFilterApplied(page, listQueries);
  expect(leaked).toEqual([]);
});
