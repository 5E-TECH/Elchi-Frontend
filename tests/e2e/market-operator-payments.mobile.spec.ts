import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openMarketOperators } from "./support/marketOperators";
import { tapTargets, tooSmall } from "./support/tapTargets";
import { toast } from "./support/toast";

/**
 * F2qp6FtE — «Operatorlar → To'lovlar» telefonda (390, market): jadval o'rniga kartalar, KPI bitta qatorda,
 * nishonlar ≥ 44 px, «To'lov yozish» — pastki varaqa va tasdiq; gorizontal oqish yo'q; kassa so'rovlari yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: kartalar, nishonlar ≥ 44 px, «To'lov yozish» pastki varaqada", async ({ page }) => {
  const mock = await openMarketOperators(page);
  await page.goto("/market-operators?view=payments");
  await expect(page.getByText("Madina Xoliqova").first()).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("So'mda · qoldiq = ishlab topdi − to'landi")).toBeVisible();
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Madina Xoliqova uchun to'lov yozish" }).click();
  const dialog = page.getByRole("dialog", { name: "To'lov yozish" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
  await dialog.getByRole("textbox", { name: "Summa" }).fill("50000");
  await dialog.getByRole("button", { name: "To'lov yozish" }).click();
  await page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" }).getByRole("button", { name: "To'lovni yozish" }).click();
  await expect(toast(page, "To'lov yozildi", { tone: "success" })).toBeVisible();
  expect(mock.payments.map((item) => item.body)).toEqual([
    expect.objectContaining({ operator_id: "41", amount: 50000 }),
  ]);
  expect(mock.cashboxRequests).toEqual([]);
  await expectNoHorizontalOverflow(page);
});
