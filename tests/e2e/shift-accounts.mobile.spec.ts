import { expect, test } from "@playwright/test";
import { mockShiftAccounts, PNG_1X1 } from "./support/shiftAccounts";

/** kiZgTybn (390): smena yopish oynasi pastki varaqa — kartalar qatori, skrinshot, yopish; hisobot telefonda kartalar. */
test("telefon: kartalar qoldig'i bilan smena yopiladi, hisobot kartalar ko'rinishida", async ({ page }) => {
  const mock = await mockShiftAccounts(page);
  await page.goto("/payments/main-cashbox");

  await page.getByRole("button", { name: "Smenani yopish" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Smenani yopish" });
  const main = dialog.getByTestId("shift-account-1");
  await expect(main).toContainText("Agrobank · ··1234");

  await dialog.getByLabel(/^Sanalgan naqd/).fill("18240000");
  await main.getByLabel(/^Ilovadagi qoldiq/).fill("2140000");
  await dialog.getByTestId("shift-account-3").getByLabel(/^Ilovadagi qoldiq/).fill("1450000");
  await dialog.getByTestId("shift-photo-input-1").setInputFiles({ name: "IMG_2210.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(main.getByText("Mos keldi")).toBeVisible();
  // Telefon: bosiladigan tugmalar ≥ 44 px, gorizontal toshish yo'q.
  const replace = main.getByRole("button", { name: "Rasmni almashtirish" });
  await expect(replace).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await dialog.getByRole("button", { name: "Smenani yopish" }).click();
  const result = page.getByRole("dialog", { name: "Smena yopildi" });
  await expect(result).toBeVisible();
  expect(mock.closes).toHaveLength(1);

  await result.getByRole("link", { name: "Smena hisoboti" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Smena hisoboti" })).toBeVisible();
  await expect(page.getByText("Asosiy karta").first()).toBeVisible();
  await expect(page.getByText("Hisob raqam").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});
