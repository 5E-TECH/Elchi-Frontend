import { expect, test } from "@playwright/test";
import { mockCashboxShift, REGIONAL_MANAGER_PROFILE } from "./support/cashboxShift";

/**
 * CB-2, telefon 390 (maketlar `manager-payments-overview-shift-closed`,
 * `manager-payments-cash-detail-courier-shift-closed`): gorizontal skroll yo'q, «Smenani ochish» ≥ 44px, ochish
 * oynasi pastki varaqa; smena ochilgach «Kuryerdan qabul qilish» formasi qaytadi. Menejerning HQ kassasi sahifasida
 * forma ham, qulf ham yo'q (ega qarori #7, IjqTYQks: HQ filial pulini o'zi oladi).
 */
test("menejer 390 «To'lovlar»: banner va bitta «Smenani ochish», toshish yo'q", async ({ page }) => {
  const mock = await mockCashboxShift(page, "manager", REGIONAL_MANAGER_PROFILE);
  await page.goto("/payments");

  const openButton = page.getByRole("button", { name: "Smenani ochish" });
  await expect(openButton).toBeVisible();
  expect((await openButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId("shift-banner")).toContainText("Smena boshlanmagan");
  await expect(page.getByRole("button", { name: "Kuryerdan qabul qilish" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});

test("menejer 390 HQ kassasi: forma va qulf yo'q — «HQ o'zi qabul qiladi», toshish yo'q", async ({ page }) => {
  const mock = await mockCashboxShift(page, "manager", REGIONAL_MANAGER_PROFILE);
  await page.goto("/payments/cash-detail/16?type=branch");

  await expect(page.getByText(/Filial pulini HQ o'zi qabul qiladi/)).toBeVisible();
  await expect(page.getByTestId("shift-locked-card")).toHaveCount(0);
  await expect(page.getByPlaceholder("0")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /HQ'ga o'tkazish$/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(mock.leaked).toEqual([]);
});

test("menejer 390 kuryer kassasi: qulf → pastki varaqa → smena ochiladi → forma", async ({ page }) => {
  const mock = await mockCashboxShift(page, "manager", REGIONAL_MANAGER_PROFILE);
  await page.goto("/payments/cash-detail/209?type=courier");

  const locked = page.getByTestId("shift-locked-card");
  await expect(locked.getByRole("heading", { name: "Kuryerdan qabul qilish" })).toBeVisible();
  await expect(locked).toContainText("Filial kassasida smena ochilgandan keyin kuryerdan pul qabul qilish ishlaydi.");
  const openButton = locked.getByRole("button", { name: "Smenani ochish" });
  expect((await openButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await openButton.click();
  const dialog = page.getByRole("dialog", { name: "Smenani ochish" });
  await expect(dialog).toBeVisible();
  // Pastki varaqa: oynaning pastki cheti ekran pastiga yopishgan (kirish animatsiyasi tugaguncha kutiladi).
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? Math.round(box.y + box.height) : -1;
    })
    .toBe(844);
  await dialog.getByRole("button", { name: "Smenani ochish" }).click();

  await expect(page.getByText("Smena ochildi", { exact: true })).toBeVisible();
  await expect(page.getByTestId("shift-locked-card")).toHaveCount(0);
  await expect(page.getByPlaceholder("0")).toBeVisible();
  expect(mock.opens).toEqual([{}]);
  expect(mock.leaked).toEqual([]);
});
