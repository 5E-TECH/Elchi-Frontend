import { expect, test, type Locator, type Page } from "@playwright/test";
import { MERGED, deleteBoz, mockDistrictsApi, openDistricts, openMergeToIzboskan } from "./support/districtsMerge";

/**
 * DM-1 — `/regions/districts` telefonda (390, admin): oynalar pastki varaqa, tugmalar ≥ 44 px, gorizontal oqish yo'q.
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
