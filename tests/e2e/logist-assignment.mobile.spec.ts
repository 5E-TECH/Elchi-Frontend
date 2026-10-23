import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  mockLogistApi,
  openLogistAssignment,
  regionsCard,
} from "./support/logistAssignment";
import { toast } from "./support/toast";

/**
 * LG-2 — `/regions/logist-assignment` telefonda (390, superadmin): logist — `Select` (pastki varaqa, qidiruv),
 * ro'yxat kartasi yashirin; o'zgarish bo'lsa pastki menyu ustida yopishqoq panel (≥ 44 px tugmalar); tasdiq
 * oynasi pastki varaqa; gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ 390: Select bilan logist, yopishqoq panel, tasdiq — pastki varaqa", async ({ page }) => {
  const mock = await mockLogistApi(page);
  await openLogistAssignment(page);

  await expect(page.getByRole("group", { name: "Logistlar ro'yxati" })).toBeHidden();
  const picker = page.getByRole("combobox", { name: "Logist" });
  await expect(picker).toBeVisible();
  await picker.click();
  await page.getByRole("option", { name: /Dilnoza Karimova/ }).click();
  await expect(page.getByRole("heading", { name: "Dilnoza Karimova viloyatlari" })).toBeVisible();
  await expect(page).toHaveURL(/\?logist=42$/);

  const card = regionsCard(page);
  for (const option of await card.getByRole("radio").all()) {
    expect((await option.boundingBox())!.height, "filtr ≥ 44px").toBeGreaterThanOrEqual(44 - 0.01);
  }
  await expect(page.getByRole("region", { name: "Saqlanmagan o'zgarishlar" })).toHaveCount(0);

  await card.getByRole("checkbox", { name: /^Sirdaryo/ }).uncheck();
  const bar = page.getByRole("region", { name: "Saqlanmagan o'zgarishlar" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("1 ta o'zgarish");
  await expect(bar).toContainText("1 olib tashlanadi");
  // Panel pastki menyu ustida: pastki chegarasi menyuning tepasidan pastga tushmaydi.
  const nav = page.getByRole("navigation").last();
  const barBox = (await bar.boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);
  for (const name of ["Bekor qilish", "Saqlash"]) {
    expect(
      (await bar.getByRole("button", { name }).boundingBox())!.height,
      name,
    ).toBeGreaterThanOrEqual(44 - 0.01);
  }
  await expectNoHorizontalOverflow(page);

  await bar.getByRole("button", { name: "Saqlash" }).click();
  const dialog = page.getByRole("alertdialog", { name: "O'zgarishlarni saqlaysizmi?" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
  await dialog.getByRole("button", { name: "Saqlash" }).click();

  await expect(toast(page, "Dilnoza Karimova · 2 ta viloyat")).toBeVisible();
  expect(mock.bulks).toEqual([{ logist_id: "42", region_ids: ["2", "6"] }]);
  await expect(page.getByRole("region", { name: "Saqlanmagan o'zgarishlar" })).toHaveCount(0);
  expect(mock.leaked).toEqual([]);
});
