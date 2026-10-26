import { expect, test } from "@playwright/test";
import { mockShiftAutoReport } from "./support/shiftAutoReport";

/** y8Tqm9Ap + gWI4gYkw (390): sozlamalar kartalari va hisobot telefonda — gorizontal toshish yo'q, kalitlar ≥ 44 px. */
test("390: avtomatik yopish / hisobot yuborish kartalari va avtomatik yopilgan smena hisoboti", async ({ page }) => {
  const mock = await mockShiftAutoReport(page);
  await page.goto("/payments/shift-settings");
  await expect(page.getByRole("heading", { name: "Smena hisobotini yuborish" })).toBeVisible();
  const telegram = page.getByRole("switch", { name: "Marketlar: Telegram" });
  await expect(telegram).toBeVisible();
  expect((await telegram.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/payments/shifts/31");
  await expect(page.getByTestId("shift-auto-closed")).toBeVisible();
  await expect(page.getByTestId("shift-delivery-market")).toContainText("Marketlar · 1 ta");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});
