import { expect, test, type Page } from "@playwright/test";
import { mockSatoApi, openSatoCodes } from "./support/satoCodes";
import { toast } from "./support/toast";

/**
 * SA-2 — `/regions/sato-management?tab=sato` telefonda (390, superadmin): sarlavhadagi «SATO kodlarini yozish N»
 * to'liq enli, tasdiq oynasi pastki varaqa; «Takroriy nomlar» — guruh sarlavhasi va to'liq enli «Birlashtirish»;
 * «Bazada yo'q» kartasida «+» → «Tuman qo'shish». Bosiladigan har narsa ≥ 44 px, gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 120_000 });

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
const tall = async (page: Page, name: string | RegExp) => {
  const box = (await page.getByRole("button", { name }).first().boundingBox())!;
  expect(box.height, String(name)).toBeGreaterThanOrEqual(44 - 0.01);
  expect(box.x + box.width, String(name)).toBeLessThanOrEqual(390);
  return box;
};

test("⭐ 390: «SATO kodlarini yozish 12» to'liq enli → pastki varaqa → «12 ta kodni yozish» → xabar", async ({ page }) => {
  const mock = await mockSatoApi(page);
  await openSatoCodes(page);

  const button = await tall(page, /^SATO kodlarini yozish/);
  expect(button.width).toBeGreaterThan(300);
  await page.getByRole("button", { name: /^SATO kodlarini yozish/ }).click();
  const dialog = page.getByRole("alertdialog", { name: "SATO kodlarini yozasizmi?" });
  await expect(dialog).toBeVisible();
  const sheet = (await dialog.boundingBox())!;
  expect(Math.round(sheet.x)).toBe(0);
  expect(Math.round(sheet.width)).toBe(390);
  for (const name of ["Bekor qilish", "12 ta kodni yozish"]) await tall(page, name);
  await noOverflow(page);

  await dialog.getByRole("button", { name: "12 ta kodni yozish" }).click();
  await expect(toast(page, "12 ta tumanga SATO kodi yozildi")).toBeVisible();
  expect(mock.posts.map((post) => post.path)).toEqual(["district/sato-match/apply"]);
  expect(mock.leaked).toEqual([]);
});

test("390: takroriylar — guruh sarlavhasi, «Birlashtirish» ≥ 44 px; «Bazada yo'q» → «+» → «Tuman qo'shish» varaqasi", async ({ page }) => {
  const mock = await mockSatoApi(page);
  await openSatoCodes(page);

  await page.getByRole("combobox", { name: "SATO bo'limi: Topildi" }).click();
  await page.getByRole("option", { name: /Takroriy nomlar/ }).click();
  const merge = await tall(page, "Bo'ka tumani yozuvlarini birlashtirish");
  expect(merge.width).toBeGreaterThan(300);
  await expect(page.getByText("Toshkent viloyati · ID 42 · Kod yo'q")).toBeVisible();
  await noOverflow(page);

  await page.getByRole("button", { name: "Bo'ka tumani yozuvlarini birlashtirish" }).click();
  const mergeDialog = page.getByRole("dialog", { name: "Tumanni birlashtirish" });
  await expect(mergeDialog).toContainText("SATO kodi 1727212 saqlanadi.");
  await tall(page, "Birlashtirish");
  await noOverflow(page);
  await mergeDialog.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(mergeDialog).toHaveCount(0);

  await page.getByRole("combobox", { name: "SATO bo'limi: Takroriy nomlar" }).click();
  await page.getByRole("option", { name: /Bazada yo'q/ }).click();
  await tall(page, "Urgut tumani — tuman qo'shish");
  await page.getByRole("button", { name: "Urgut tumani — tuman qo'shish" }).click();
  const add = page.getByRole("dialog", { name: "Tuman qo'shish" });
  await expect(add.getByRole("textbox", { name: "SATO kodi" })).toHaveValue("1718236");
  for (const name of ["Bekor qilish", "Tuman qo'shish"]) await tall(page, name);
  await noOverflow(page);
  expect(mock.posts).toEqual([]);
  expect(mock.leaked).toEqual([]);
});
