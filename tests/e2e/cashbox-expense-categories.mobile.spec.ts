import { expect, test } from "@playwright/test";
import {
  categoryCombobox,
  expectNoHorizontalOverflow,
  expectOpsExpenseCategories,
  mockCashboxCategoriesApi,
  openMainCashbox,
  openSpendDialog,
  opsCategoriesCard,
  opsCategoriesList,
} from "./support/cashboxExpenseCategories";
import { expectToast } from "./support/toast";

/**
 * Elchi Pochta №1 — telefonda (390): «Kassadan xarajat» pastki varaqasida kategoriya tanlovi (maydon va variantlar
 * ≥ 44 px, qidiruv maydoni 16 px — iOS zoom yo'q), tarix kartasida kategoriya, kassa sarlavhasida sozlama tugmasi
 * yo'q; superadmin boshqaruvi — Ops vositalari → «Xarajat kategoriyalari» (telefonda bo'lim `Select` dan), qator
 * amallari va «Kategoriya qo'shish» ≥ 44 px, forma — pastki varaqa; gorizontal oqish yo'q.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: varaqada kategoriya majburiy (xato ko'rinadi), izohsiz → payload'da `comment` yo'q, oqish yo'q", async ({ page }) => {
  const { calls, leaked } = await mockCashboxCategoriesApi(page);
  await openMainCashbox(page);
  // Sozlama kassada emas (Ops vositalarida).
  await expect(page.getByRole("button", { name: "Xarajat kategoriyalari" })).toHaveCount(0);

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

test("⭐ 390: Ops → «Xarajat kategoriyalari» — bo'lim tanlovidan, amallar ≥ 44 px, qo'shish formasi pastki varaqa, oqish yo'q", async ({ page }) => {
  const { calls } = await mockCashboxCategoriesApi(page);
  await page.goto("/ops");
  await expect(page.getByRole("heading", { level: 1, name: "Ops vositalari" })).toBeVisible({ timeout: 60_000 });

  // Telefonda tablar o'rniga `Select` — «Xarajat kategoriyalari» moliya guruhida, «Moliya operatorlari» dan keyin.
  await page.getByRole("combobox", { name: /^Ops bo'limi:/ }).click();
  const options = page.getByRole("option");
  await expect(options.nth(0)).toHaveText("Moliya operatorlari");
  await expect(options.nth(1)).toHaveText("Xarajat kategoriyalari");
  await options.nth(1).click();
  await expectOpsExpenseCategories(page);
  await expect(page.getByRole("combobox", { name: "Ops bo'limi: Xarajat kategoriyalari" })).toBeVisible();

  const card = opsCategoriesCard(page);
  const list = opsCategoriesList(page);
  await expect(list.getByRole("listitem")).toHaveCount(17);
  const add = card.getByRole("button", { name: "Kategoriya qo'shish" });
  const addBox = (await add.boundingBox())!;
  expect(addBox.height).toBeGreaterThanOrEqual(44);

  const actions = list.getByRole("button", { name: /kategoriyasini (tahrirlash|o'chirish)$/ });
  await expect(actions).toHaveCount(34);
  const sizes = await actions.evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      return [rect.width, rect.height];
    }),
  );
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);

  await add.click();
  const form = page.getByRole("dialog", { name: "Kategoriya qo'shish" });
  await expect(form).toBeVisible();
  // Pastki varaqa: ochilish harakati tugagach pastki cheti ekran pastida.
  await expect
    .poll(async () => {
      const box = await form.boundingBox();
      return box ? Math.round(box.y + box.height) : 0;
    })
    .toBeGreaterThanOrEqual(844 - 1);
  const name = form.getByLabel(/^Nomi/);
  expect(await name.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  await name.fill("Bank xizmati");
  await form.getByLabel(/^Tartib raqami/).fill("3");
  await form.getByRole("button", { name: "Qo'shish" }).click();
  await expectToast(page, "Kategoriya qo'shildi", { tone: "success" });
  await expect(form).toBeHidden();
  expect(calls.creates).toEqual([{ name: "Bank xizmati", sort_order: 3 }]);
  await expect(list.getByRole("listitem").nth(3)).toContainText("Bank xizmati");
  await expectNoHorizontalOverflow(page);
});
