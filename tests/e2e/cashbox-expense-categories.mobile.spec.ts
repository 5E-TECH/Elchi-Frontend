import { expect, test } from "@playwright/test";
import {
  categoryCombobox,
  expectNoHorizontalOverflow,
  mockCashboxCategoriesApi,
  openMainCashbox,
  openSpendDialog,
} from "./support/cashboxExpenseCategories";
import { expectToast } from "./support/toast";

/**
 * Elchi Pochta №1 — telefonda (390): «Kassadan xarajat» pastki varaqasida kategoriya tanlovi (maydon va variantlar
 * ≥ 44 px, qidiruv maydoni 16 px — iOS zoom yo'q), tarix kartasida kategoriya; superadmin boshqaruv oynasi — pastki
 * varaqa, qator amallari ≥ 44 px; gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: varaqada kategoriya majburiy (xato ko'rinadi), izohsiz → payload'da `comment` yo'q, oqish yo'q", async ({ page }) => {
  const { calls, leaked } = await mockCashboxCategoriesApi(page);
  await openMainCashbox(page);

  const card = page.getByRole("button", { name: /Qo'lda chiqim · Yoqilg'i/ });
  await expect(card.locator("[data-expense-category]")).toHaveText("Kategoriya: Yoqilg'i");

  const dialog = await openSpendDialog(page, { comment: "" });
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);

  const field = categoryCombobox(page);
  // Kategoriyasiz saqlash — maydon ostida xato (varaqa ichida ko'rinadi), so'rov yo'q.
  await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
  const required = dialog.getByText("Xarajat kategoriyasini tanlang");
  await expect(required).toBeVisible();
  await expect(required).toBeInViewport();
  expect(calls.spends).toEqual([]);
  await field.scrollIntoViewIfNeeded();
  const fieldBox = (await field.locator("xpath=..").boundingBox())!;
  expect(fieldBox.height).toBeGreaterThanOrEqual(44);
  expect(await field.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);

  await field.fill("benzin");
  const option = page.getByRole("option", { name: /Yoqilg'i/ });
  await expect(option).toBeVisible();
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await option.click();
  await expect(field).toHaveValue("Yoqilg'i");
  await expectNoHorizontalOverflow(page);

  await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
  await page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
  await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });
  expect(calls.spends[0].body).toEqual({ amount: 150_000, type: "cash", expense_category_id: "2" });
  expect(leaked).toEqual([]);
});

test("⭐ 390: boshqaruv oynasi — pastki varaqa, amallar ≥ 44 px, qo'shish formasi", async ({ page }) => {
  const { calls } = await mockCashboxCategoriesApi(page);
  await openMainCashbox(page);

  await page.getByRole("button", { name: "Xarajat kategoriyalari" }).click();
  const manage = page.getByRole("dialog", { name: "Xarajat kategoriyalari" });
  await expect(manage.getByRole("list", { name: "Xarajat kategoriyalari" }).getByRole("listitem")).toHaveCount(17);
  const box = (await manage.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);

  const actions = manage.getByRole("button", { name: /kategoriyasini (tahrirlash|o'chirish)$/ });
  await expect(actions).toHaveCount(34);
  // Pastki varaqa ochilish animatsiyasi tugaguncha tugmalar kichikroq o'lchanishi mumkin — barqaror o'lchamni
  // kutamiz (dispatch-floor.mobile.spec bilan bir xil usul).
  await expect
    .poll(async () =>
      Math.min(
        ...(await actions.evaluateAll((nodes) =>
          nodes.slice(0, 6).flatMap((node) => {
            const rect = node.getBoundingClientRect();
            return [rect.width, rect.height];
          }),
        )),
      ),
    )
    .toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);

  await manage.getByRole("button", { name: "Kategoriya qo'shish" }).click();
  const form = page.getByRole("dialog", { name: "Kategoriya qo'shish" });
  const name = form.getByLabel(/^Nomi/);
  expect(await name.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  await name.fill("Bank xizmati");
  await form.getByLabel(/^Tartib raqami/).fill("3");
  await form.getByRole("button", { name: "Qo'shish" }).click();
  await expectToast(page, "Kategoriya qo'shildi", { tone: "success" });
  expect(calls.creates).toEqual([{ name: "Bank xizmati", sort_order: 3 }]);
  await expect(manage.getByRole("listitem").nth(3)).toContainText("Bank xizmati");
  await expectNoHorizontalOverflow(page);
});
