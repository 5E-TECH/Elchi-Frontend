import { expect, test } from "@playwright/test";
import {
  categoryCombobox,
  mockCashboxCategoriesApi,
  openMainCashbox,
  openSpendDialog,
} from "./support/cashboxExpenseCategories";
import { expectToast } from "./support/toast";

/**
 * Elchi Pochta №1 — kassa xarajatlari kategoriyalari (1440px). Gateway soxta va qat'iy
 * (`support/cashboxExpenseCategories.ts`): DTO'dan tashqari maydon, faol bo'lmagan kategoriya, `fill` dagi
 * `expense_category_id` — 400; boshqaruv faqat superadminga.
 */
test.describe("Asosiy kassa — xarajat kategoriyalari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ xarajat kategoriya bilan: 17 ta tanlov, payload aynan DTO, tarix va tafsilotda nom", async ({ page }) => {
    const { calls, leaked } = await mockCashboxCategoriesApi(page);
    await openMainCashbox(page);

    // Tarix: mavjud chiqim qatorida kategoriya belgisi.
    const table = page.getByRole("table", { name: "Operatsiyalar tarixi" });
    await expect(table.locator("[data-expense-category]")).toHaveText(["Kategoriya: Yoqilg'i"]);

    const dialog = await openSpendDialog(page, { amount: "320000", comment: "Ombor ijarasi, oktabr" });
    await categoryCombobox(page).click();
    const listbox = page.getByRole("listbox", { name: "Xarajat kategoriyalari" });
    await expect(listbox.getByRole("option")).toHaveCount(17);
    await expect(listbox.getByRole("option").first()).toContainText("Ovqatlanish");
    await expect(listbox.getByRole("option").first()).toContainText("Xodimlarning ovqati, tushlik");
    await listbox.getByRole("option", { name: /Ijara \(arenda\)/ }).click();
    await expect(dialog.getByText("Nimalar kiradi: Filial, ombor, ofis ijarasi")).toBeVisible();

    await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    await expect(confirm.getByText("Ijara (arenda)")).toBeVisible();
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });
    expect(calls.spends).toHaveLength(1);
    expect(calls.spends[0].status).toBe(200);
    expect(calls.spends[0].body).toEqual({
      amount: 320_000,
      type: "cash",
      comment: "Ombor ijarasi, oktabr",
      expense_category_id: "4",
    });
    expect(calls.spends[0].key).toBeTruthy();

    const row = table.locator("tr", { hasText: "Ombor ijarasi, oktabr" });
    await expect(row.locator("[data-expense-category]")).toHaveText("Kategoriya: Ijara (arenda)");
    await row.getByRole("button", { name: "Qo'lda chiqim" }).first().click();
    const detail = page.getByRole("dialog", { name: "Chiqim operatsiyasi" });
    await expect(detail.locator("dt", { hasText: "Kategoriya" })).toBeVisible();
    await expect(detail.locator("[data-expense-category]")).toHaveText("Ijara (arenda)");
    expect(leaked).toEqual([]);
  });

  test("kategoriyasiz xarajat va to'ldirish — `expense_category_id` umuman yuborilmaydi", async ({ page }) => {
    const { calls, leaked } = await mockCashboxCategoriesApi(page, { role: "admin" });
    await openMainCashbox(page);
    await expect(page.getByRole("button", { name: "Xarajat kategoriyalari" })).toHaveCount(0);

    const spend = await openSpendDialog(page, { comment: "Kanselyariya" });
    await expect(categoryCombobox(page)).toBeVisible();
    await spend.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });

    await page.getByRole("button", { name: /Kassani to'ldirish/ }).click();
    const fill = page.getByRole("dialog", { name: "Kassani to'ldirish" });
    await expect(fill.getByRole("combobox", { name: /kategoriya/i })).toHaveCount(0);
    await fill.getByLabel(/^Summa/).fill("500000");
    await fill.getByRole("radio", { name: "Naqd" }).click();
    await fill.getByLabel(/^Izoh/).fill("Bankdan naqd");
    await fill.getByRole("button", { name: "Kirimni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Kirimni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Kassa muvaffaqiyatli to'ldirildi", { tone: "success" });

    expect(calls.spends.map((call) => [call.status, call.body])).toEqual([
      [200, { amount: 150_000, type: "cash", comment: "Kanselyariya" }],
    ]);
    expect(calls.fills.map((call) => [call.status, call.body])).toEqual([
      [200, { amount: 500_000, type: "cash", comment: "Bankdan naqd" }],
    ]);
    expect(leaked).toEqual([]);
  });

  test("⭐ superadmin boshqaruvi: qo'shish → tanlovda chiqadi, takror nom 409, tahrirlash, o'chirish tasdiq bilan", async ({ page }) => {
    const { calls, state, leaked } = await mockCashboxCategoriesApi(page);
    await openMainCashbox(page);

    await page.getByRole("button", { name: "Xarajat kategoriyalari" }).click();
    const manage = page.getByRole("dialog", { name: "Xarajat kategoriyalari" });
    const list = manage.getByRole("list", { name: "Xarajat kategoriyalari" });
    await expect(list.getByRole("listitem")).toHaveCount(17);
    await expect(manage.getByText("«Kassadan xarajat» oynasidagi ro'yxat · 17 ta")).toBeVisible();

    // Qo'shish (tartib raqami bo'sh — oxiriga).
    await manage.getByRole("button", { name: "Kategoriya qo'shish" }).click();
    const form = page.getByRole("dialog", { name: "Kategoriya qo'shish" });
    await form.getByLabel(/^Nomi/).fill("Bank xizmati");
    await form.getByLabel(/^Nimalar kiradi/).fill("Komissiya, karta xizmati");
    await form.getByRole("button", { name: "Qo'shish" }).click();
    await expectToast(page, "Kategoriya qo'shildi", { tone: "success" });
    await expect(list.getByRole("listitem")).toHaveCount(18);
    await expect(list.getByRole("listitem").last()).toContainText("Bank xizmati");
    expect(calls.creates).toEqual([{ name: "Bank xizmati", description: "Komissiya, karta xizmati" }]);

    // Takror nom — 409, matn «Nomi» ostida.
    await manage.getByRole("button", { name: "Kategoriya qo'shish" }).click();
    await form.getByLabel(/^Nomi/).fill("yoqilg'i");
    await form.getByRole("button", { name: "Qo'shish" }).click();
    await expect(form.getByText("\"yoqilg'i\" nomli kategoriya allaqachon bor")).toBeVisible();
    await expect(form.getByLabel(/^Nomi/)).toHaveAttribute("aria-invalid", "true");
    await form.getByRole("button", { name: "Orqaga" }).click();

    // Tahrirlash — faqat o'zgargan maydon.
    await manage.getByRole("button", { name: "«Yoqilg'i» kategoriyasini tahrirlash" }).click();
    const edit = page.getByRole("dialog", { name: "Kategoriyani tahrirlash" });
    await expect(edit.getByLabel(/^Nomi/)).toHaveValue("Yoqilg'i");
    await edit.getByLabel(/^Nomi/).fill("Yoqilg'i va moy");
    await edit.getByRole("button", { name: "Saqlash" }).click();
    await expectToast(page, "Kategoriya saqlandi", { tone: "success" });
    expect(calls.updates).toEqual([{ id: "2", body: { name: "Yoqilg'i va moy" } }]);
    await expect(list.getByRole("listitem").nth(1)).toContainText("Yoqilg'i va moy");

    // O'chirish — tasdiq oynasi, tarix nomni saqlaydi.
    await manage.getByRole("button", { name: "«Qaytarilgan pullar» kategoriyasini o'chirish" }).click();
    const confirm = page.getByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await expect(confirm.getByText("Avval yozilgan xarajatlarda kategoriya nomi saqlanib qoladi.")).toBeVisible();
    await confirm.getByRole("button", { name: "O'chirish" }).click();
    await expectToast(page, "Kategoriya o'chirildi", { tone: "success" });
    await expect(list.getByRole("listitem")).toHaveCount(17);
    await expect(list.getByText("Qaytarilgan pullar")).toHaveCount(0);
    expect(calls.deletes).toEqual(["17"]);
    expect(state.categories.find((category) => category.id === "17")?.is_deleted).toBe(true);

    // «Kassadan xarajat» tanlovi shu keshdan: yangisi bor, o'chirilgani yo'q, nomi yangilangan.
    await manage.getByRole("button", { name: "Yopish" }).last().click();
    await expect(manage).toBeHidden();
    await openSpendDialog(page);
    await categoryCombobox(page).click();
    const options = page.getByRole("listbox", { name: "Xarajat kategoriyalari" }).getByRole("option");
    await expect(options).toHaveCount(17);
    await expect(options.filter({ hasText: "Bank xizmati" })).toHaveCount(1);
    await expect(options.filter({ hasText: "Qaytarilgan pullar" })).toHaveCount(0);
    await expect(options.filter({ hasText: "Yoqilg'i va moy" })).toHaveCount(1);
    expect(leaked).toEqual([]);
  });

  test("tanlangan kategoriya boshqa joyda o'chirilsa: 400 matni, tanlov tozalanadi, qayta yuborish kategoriyasiz", async ({ page }) => {
    const { calls, state } = await mockCashboxCategoriesApi(page);
    await openMainCashbox(page);
    const dialog = await openSpendDialog(page);
    await categoryCombobox(page).click();
    await page.getByRole("option", { name: /^Ta'mirlash/ }).click();

    state.categories.find((category) => category.name === "Ta'mirlash")!.is_deleted = true;
    await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Xarajat kategoriyasi topilmadi yoki o'chirilgan", { tone: "error" });
    await expect(dialog).toBeVisible();
    await expect(categoryCombobox(page)).toHaveValue("");

    await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });
    expect(calls.spends.map((call) => call.status)).toEqual([400, 200]);
    expect(calls.spends[1].body).not.toHaveProperty("expense_category_id");
    expect(calls.spends[1].key).toBe(calls.spends[0].key);
  });
});
