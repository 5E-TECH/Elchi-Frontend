import { expect, test } from "@playwright/test";
import { mockShiftLatePhoto, SCREENSHOT_PNG } from "./support/shiftLatePhoto";

/**
 * BE-B (390): smena hisobotida karta rasmi holati kartalarda, «Rasm yuklash» — to'liq enli, ≥ 44 px; oyna pastki
 * varaqa, gorizontal toshish yo'q; yuklagach kartada «Keyin yuklandi».
 */
test("390: kartada rasm holati va «Rasm yuklash» — pastki varaqa", async ({ page }) => {
  const mock = await mockShiftLatePhoto(page);
  await page.goto("/payments/shifts/31");
  const humo = page.getByTestId("shift-photo-status-2");
  // Birinchi ochilishda dev server sahifa bo'lagini yig'adi — kutish uzunroq.
  await expect(humo).toContainText("Rasm kutilmoqda", { timeout: 30_000 });
  await expect(page.getByRole("table", { name: "Kartalar bo'yicha natijalar" })).toHaveCount(0);

  const upload = humo.getByRole("button", { name: "Rasm yuklash: Humo virtual" });
  const box = await upload.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await upload.click();

  const dialog = page.getByRole("dialog", { name: "Rasmni keyin yuklash" });
  await expect(dialog).toBeVisible();
  // Pastki varaqa: ekran pastiga yopishgan, to'liq en.
  const sheet = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(Math.round(sheet?.width ?? 0)).toBe(viewport?.width);
  await expect.poll(async () => Math.round(((await dialog.boundingBox())?.y ?? 0) + ((await dialog.boundingBox())?.height ?? 0))).toBe(viewport?.height);

  await dialog.getByTestId("late-photo-input").setInputFiles({ name: "IMG_2211.png", mimeType: "image/png", buffer: SCREENSHOT_PNG });
  await expect(dialog.getByRole("img", { name: "Humo virtual skrinshoti" })).toBeVisible();
  await dialog.getByLabel(/^Ilovadagi qoldiq/).fill("1850000");
  const submit = dialog.getByRole("button", { name: "Yuklash" });
  expect((await submit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expect(page.getByText("Rasm yuklandi", { exact: true }).first()).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(mock.uploads.map((item) => item.fields)).toEqual([["photo", "entered_balance"]]);
  await expect(humo).toContainText("Keyin yuklandi");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});
