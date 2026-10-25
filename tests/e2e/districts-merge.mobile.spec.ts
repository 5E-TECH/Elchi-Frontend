import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  COUNT_MISMATCH,
  MANUAL_FIX,
  MERGED,
  deleteBoz,
  mockDistrictsApi,
  openDistricts,
  openMergeToIzboskan,
} from "./support/districtsMerge";

/**
 * DM-1, DM-2 — `/regions/districts` telefonda (390, admin): oynalar (xato oynalari ham) pastki varaqa, tugmalar
 * ≥ 44 px, gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 120_000 });

const expectSheet = async (page: Page, dialog: Locator, buttons: string[]) => {
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
  for (const name of buttons) {
    const button = (await dialog.getByRole("button", { name, exact: true }).last().boundingBox())!;
    // Varaqa siljish harakatida o'lcham suzuvchi nuqtada keladi (43.99993) — 0.01 px chidamlilik.
    expect(button.height, `${name}: telefonda ≥ 44px`).toBeGreaterThanOrEqual(44 - 0.01);
    expect(button.x + button.width, name).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
};

test("⭐ 390: o'chirib bo'lmaydi va birlashtirish oynalari — pastki varaqa, ≥ 44 px, natija", async ({ page }) => {
  const mock = await mockDistrictsApi(page, () => ({ status: 200, body: MERGED, delayMs: 800 }));
  await openDistricts(page);

  const blocked = await deleteBoz(page);
  await expectSheet(page, blocked, ["Yopish", "Birlashtirish"]);
  await blocked.getByRole("button", { name: "Yopish" }).last().click();
  await expect(blocked).toBeHidden();

  const dialog = await openMergeToIzboskan(page);
  await expectSheet(page, dialog, ["Bekor qilish", "Birlashtirish"]);
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();

  const progress = page.getByRole("alertdialog", { name: "Birlashtirilmoqda…" });
  await expect(progress).toBeVisible();
  const result = page.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
  await expect(result).toBeVisible();
  await expectSheet(page, result, ["Yopish"]);
  await expect(result.getByRole("list", { name: "Izboskan tumanida endi" })).toContainText("1 254 ta");
  expect(mock.leaked).toEqual([]);
});

test("⭐ 390: xato oynasi — pastki varaqa, «Sabab», «Qayta urinish» → natija", async ({ page }) => {
  let calls = 0;
  const mock = await mockDistrictsApi(page, () => {
    calls += 1;
    return calls === 1 ? COUNT_MISMATCH : { status: 200, body: MERGED, delayMs: 500 };
  });
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  await expect(dialog.getByRole("list", { name: "Ko'chiriladiganlar" })).toContainText("128 ta");
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();

  const error = page.getByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });
  await expect(error).toBeVisible();
  await expectSheet(page, error, ["Xabarni nusxalash", "Qayta urinish"]);
  await expect(error.getByTestId("merge-error-reason")).toContainText("Sonlar mos kelmadi");
  await error.getByRole("button", { name: "Qayta urinish" }).click();

  const result = page.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
  await expect(result).toBeVisible();
  await expectSheet(page, result, ["Yopish"]);
  await expect(result.getByRole("list", { name: "Ko'chirildi" })).toContainText("128 ta");
  expect(mock.mergeBodies).toHaveLength(2);
});

test("390: «Birlashtirish chala qoldi» — pastki varaqa, ≥ 44 px", async ({ page }) => {
  await mockDistrictsApi(page, () => MANUAL_FIX);
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();
  const manual = page.getByRole("alertdialog", { name: "Birlashtirish chala qoldi" });
  await expect(manual).toBeVisible();
  await expectSheet(page, manual, ["Xabarni nusxalash", "Faoliyat jurnalini ochish"]);
  await expect(manual.getByRole("list", { name: "Bo'z tumaniga qaytmaganlar" }).getByRole("listitem")).toHaveCount(2);
});
