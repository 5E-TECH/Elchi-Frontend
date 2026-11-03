import { expect, test } from "@playwright/test";
import { mockShiftAutoReport } from "./support/shiftAutoReport";

/**
 * T6-FE-3 (2wgTzcG0), 390: «To'lovlarni tuzatish muddati» telefonda — segment to'liq enli, 4 ta teng variant, har biri
 * ≥ 44 px; «Kunlar soni» ≥ 44 px, 16 px shrift; 400 — xato va «Saqlash» o'chiq; 45 → PATCH { window_days: 45 } (son);
 * gorizontal toshish yo'q.
 */
test.use({ timezoneId: "Asia/Tashkent" });

test("390: muddat segmenti va «Kunlar soni» — 44 px, xato, saqlash, toshish yo'q", async ({ page }) => {
  const mock = await mockShiftAutoReport(page);
  await page.goto("/payments/shift-settings");
  const card = page.getByRole("region", { name: "To'lovlarni tuzatish muddati" });
  await card.scrollIntoViewIfNeeded();
  const group = card.getByRole("radiogroup", { name: "Muddat" });
  await expect(group).toBeVisible();

  const groupBox = await group.boundingBox();
  const cardBox = await card.boundingBox();
  // Segment karta tanasining to'liq kengligida (ichki chekka 20 px).
  expect(groupBox!.width).toBeGreaterThan(cardBox!.width - 2 * 20 - 4);
  const widths: number[] = [];
  for (const name of ["7 kun", "10 kun", "30 kun", "Boshqa"]) {
    const box = await card.getByRole("radio", { name }).boundingBox();
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
    widths.push(box!.width);
  }
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);

  await card.getByRole("radio", { name: "Boshqa" }).click();
  const days = card.getByRole("textbox", { name: "Kunlar soni" });
  await expect(days).toBeFocused();
  expect((await days.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await days.evaluate((input) => getComputedStyle(input).fontSize)).toBe("16px");

  await days.fill("400");
  await expect(card.getByText("1 dan 365 gacha butun son kiriting")).toBeVisible();
  const save = page.getByRole("button", { name: "Saqlash" });
  await expect(save).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await days.fill("45");
  await save.click();
  await expect(page.getByText("To'lovlarni tuzatish muddati: 45 kun.", { exact: true }).first()).toBeVisible();
  expect(mock.correctionPatches).toEqual([{ window_days: 45 }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});
