import { expect, test } from "@playwright/test";
import {
  categoryCombobox,
  expectMainCashbox,
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
 * Elchi Pochta №1 — kassa xarajatlari kategoriyalari (1440px). Gateway soxta va qat'iy
 * (`support/cashboxExpenseCategories.ts`): DTO'dan tashqari maydon, kategoriyasiz chiqim, faol bo'lmagan
 * kategoriya, `fill` dagi `expense_category_id` — 400; boshqaruv faqat superadminga — Ops vositalari → «Xarajat
 * kategoriyalari» tabida (2026-10-23 dan; kassa sarlavhasida tugma yo'q). Ega 2026-10-22: xarajatda kategoriya
 * majburiy, izoh ixtiyoriy (bo'sh izoh yuborilmaydi).
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

  test("⭐ kategoriyasiz xarajat saqlanmaydi; izohsiz — `comment` yuborilmaydi; to'ldirishda kategoriya yo'q, izoh majburiy", async ({ page }) => {
    const { calls, leaked } = await mockCashboxCategoriesApi(page, { role: "admin" });
    await openMainCashbox(page);
    await expect(page.getByRole("button", { name: "Xarajat kategoriyalari" })).toHaveCount(0);

    const spend = await openSpendDialog(page, { comment: "" });
    await expect(spend.locator("label", { hasText: /^Izoh/ })).toHaveText("Izoh (ixtiyoriy)");
    await expect(categoryCombobox(page)).toHaveAttribute("aria-required", "true");

    // Kategoriyasiz — maydon ostida xato, tasdiq ham so'rov ham yo'q.
    await spend.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await expect(spend.getByText("Xarajat kategoriyasini tanlang")).toBeVisible();
    await expect(categoryCombobox(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(calls.spends).toEqual([]);

    // Faqat kategoriya (izohsiz) — payload'da `comment` kaliti yo'q.
    await categoryCombobox(page).click();
    await page.getByRole("option", { name: /^Ofis xarajatlari/ }).click();
    await expect(spend.getByText("Xarajat kategoriyasini tanlang")).toHaveCount(0);
    await spend.getByRole("button", { name: "Xarajatni saqlash" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" });
    await expect(confirm.getByText("Ofis xarajatlari")).toBeVisible();
    await expect(confirm.getByText("Izoh", { exact: true })).toHaveCount(0);
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });

    // Tarixda izohsiz qator — kategoriya belgisi bilan.
    const table = page.getByRole("table", { name: "Operatsiyalar tarixi" });
    await expect(table.locator("[data-expense-category]", { hasText: "Ofis xarajatlari" })).toHaveCount(1);

    await page.getByRole("button", { name: /Kassani to'ldirish/ }).click();
    const fill = page.getByRole("dialog", { name: "Kassani to'ldirish" });
    await expect(fill.getByRole("combobox", { name: /kategoriya/i })).toHaveCount(0);
    await fill.getByLabel(/^Summa/).fill("500000");
    await fill.getByRole("radio", { name: "Naqd" }).click();
    await fill.getByRole("button", { name: "Kirimni saqlash" }).click();
    await expect(fill.getByText("Izoh majburiy — pul qayerdan kelganini yozing")).toBeVisible();
    await fill.getByLabel(/^Izoh/).fill("Bankdan naqd");
    await fill.getByRole("button", { name: "Kirimni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Kirimni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Kassa muvaffaqiyatli to'ldirildi", { tone: "success" });

    expect(calls.spends.map((call) => [call.status, call.body])).toEqual([
      [200, { amount: 150_000, type: "cash", expense_category_id: "10" }],
    ]);
    expect(calls.fills.map((call) => [call.status, call.body])).toEqual([
      [200, { amount: 500_000, type: "cash", comment: "Bankdan naqd" }],
    ]);
    expect(leaked).toEqual([]);
  });

  test("kategoriyalar hali yo'q: saqlash bloklangan; havola Ops tabiga olib boradi → qo'shadi → kassaga qaytib tanlaydi va saqlaydi", async ({ page }) => {
    const { calls, leaked } = await mockCashboxCategoriesApi(page, { emptyCategories: true });
    await openMainCashbox(page);

    const spend = await openSpendDialog(page, { comment: "Printer qog'ozi" });
    await expect(
      spend.getByText("Kategoriyalar hali qo'shilmagan — xarajatni saqlash uchun avval kategoriya qo'shing"),
    ).toBeVisible();
    await expect(categoryCombobox(page)).toBeDisabled();
    await expect(spend.getByRole("button", { name: "Xarajatni saqlash" })).toBeDisabled();

    // Boshqaruv oynasi kassada yo'q — havola Ops vositalaridagi sozlama tabiga o'tadi (oyna sahifa bilan yopiladi).
    await expect(spend.getByRole("button", { name: "Xarajat kategoriyalari" })).toHaveCount(0);
    const link = spend.getByRole("link", { name: "Xarajat kategoriyalari" });
    await expect(link).toHaveAttribute("href", "/ops?tab=expense-categories");
    await link.click();
    await expectOpsExpenseCategories(page);
    await expect(page.getByRole("dialog", { name: "Kassadan xarajat" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Xarajat kategoriyalari" })).toHaveAttribute("aria-selected", "true");
    await expect(opsCategoriesCard(page).getByText("Kategoriyalar yo'q")).toBeVisible();

    await opsCategoriesCard(page).getByRole("button", { name: "Kategoriya qo'shish" }).click();
    const form = page.getByRole("dialog", { name: "Kategoriya qo'shish" });
    await form.getByLabel(/^Nomi/).fill("Ofis xarajatlari");
    await form.getByRole("button", { name: "Qo'shish" }).click();
    await expectToast(page, "Kategoriya qo'shildi", { tone: "success" });
    await expect(form).toBeHidden();
    await expect(opsCategoriesList(page).getByRole("listitem")).toHaveCount(1);

    // «Orqaga» — kassa; tanlovda yangi kategoriya (kesh o'sha), xarajat saqlanadi.
    await page.goBack();
    await expectMainCashbox(page);
    const again = await openSpendDialog(page, { comment: "Printer qog'ozi" });
    await expect(categoryCombobox(page)).toBeEnabled();
    await categoryCombobox(page).click();
    await page.getByRole("option", { name: /^Ofis xarajatlari/ }).click();
    await again.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });
    expect(calls.creates).toEqual([{ name: "Ofis xarajatlari" }]);
    expect(calls.spends.map((call) => [call.status, call.body])).toEqual([
      [200, { amount: 150_000, type: "cash", comment: "Printer qog'ozi", expense_category_id: "1" }],
    ]);
    expect(leaked).toEqual([]);
  });

  test("⭐ superadmin boshqaruvi Ops'da: kassada tugma yo'q; qo'shish, takror nom 409, tahrirlash, o'chirish tasdiq bilan → tanlovda", async ({ page }) => {
    const { calls, state, leaked } = await mockCashboxCategoriesApi(page);
    await openMainCashbox(page);
    // Sozlama kassa sarlavhasida emas.
    await expect(page.getByRole("button", { name: "Xarajat kategoriyalari" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Xarajat kategoriyalari" })).toHaveCount(0);

    // Ops vositalari → «Xarajat kategoriyalari» (moliya guruhi — «Moliya operatorlari» dan keyin), URL'da tab.
    await page.goto("/ops");
    const tabs = page.getByRole("tablist", { name: "Ops bo'limlari" }).getByRole("tab");
    await expect(tabs.nth(0)).toHaveText("Moliya operatorlari");
    await expect(tabs.nth(1)).toHaveText("Xarajat kategoriyalari");
    await tabs.nth(1).click();
    await expectOpsExpenseCategories(page);

    const card = opsCategoriesCard(page);
    const list = opsCategoriesList(page);
    await expect(list.getByRole("listitem")).toHaveCount(17);
    await expect(card.getByText("17 ta")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Qo'shish (tartib raqami bo'sh — oxiriga).
    await card.getByRole("button", { name: "Kategoriya qo'shish" }).click();
    let form = page.getByRole("dialog", { name: "Kategoriya qo'shish" });
    await form.getByLabel(/^Nomi/).fill("Bank xizmati");
    await form.getByLabel(/^Nimalar kiradi/).fill("Komissiya, karta xizmati");
    await form.getByRole("button", { name: "Qo'shish" }).click();
    await expectToast(page, "Kategoriya qo'shildi", { tone: "success" });
    await expect(form).toBeHidden();
    await expect(list.getByRole("listitem")).toHaveCount(18);
    await expect(list.getByRole("listitem").last()).toContainText("Bank xizmati");
    expect(calls.creates).toEqual([{ name: "Bank xizmati", description: "Komissiya, karta xizmati" }]);

    // Takror nom — 409, matn «Nomi» ostida, oyna ochiq.
    await card.getByRole("button", { name: "Kategoriya qo'shish" }).click();
    form = page.getByRole("dialog", { name: "Kategoriya qo'shish" });
    await expect(form.getByLabel(/^Nomi/)).toHaveValue("");
    await form.getByLabel(/^Nomi/).fill("yoqilg'i");
    await form.getByRole("button", { name: "Qo'shish" }).click();
    await expect(form.getByText("\"yoqilg'i\" nomli kategoriya allaqachon bor")).toBeVisible();
    await expect(form.getByLabel(/^Nomi/)).toHaveAttribute("aria-invalid", "true");
    await form.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(form).toBeHidden();

    // Tahrirlash — faqat o'zgargan maydon.
    await list.getByRole("button", { name: "«Yoqilg'i» kategoriyasini tahrirlash" }).click();
    const edit = page.getByRole("dialog", { name: "Kategoriyani tahrirlash" });
    await expect(edit.getByLabel(/^Nomi/)).toHaveValue("Yoqilg'i");
    await edit.getByLabel(/^Nomi/).fill("Yoqilg'i va moy");
    await edit.getByRole("button", { name: "Saqlash" }).click();
    await expectToast(page, "Kategoriya saqlandi", { tone: "success" });
    await expect(edit).toBeHidden();
    expect(calls.updates).toEqual([{ id: "2", body: { name: "Yoqilg'i va moy" } }]);
    await expect(list.getByRole("listitem").nth(1)).toContainText("Yoqilg'i va moy");

    // O'chirish — tasdiq oynasi, tarix nomni saqlaydi.
    await list.getByRole("button", { name: "«Qaytarilgan pullar» kategoriyasini o'chirish" }).click();
    const confirm = page.getByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await expect(confirm.getByText("Avval yozilgan xarajatlarda kategoriya nomi saqlanib qoladi.")).toBeVisible();
    await confirm.getByRole("button", { name: "O'chirish" }).click();
    await expectToast(page, "Kategoriya o'chirildi", { tone: "success" });
    await expect(list.getByRole("listitem")).toHaveCount(17);
    await expect(list.getByText("Qaytarilgan pullar")).toHaveCount(0);
    expect(calls.deletes).toEqual(["17"]);
    expect(state.categories.find((category) => category.id === "17")?.is_deleted).toBe(true);
    await expectNoHorizontalOverflow(page);

    // «Kassadan xarajat» tanlovi: yangisi bor, o'chirilgani yo'q, nomi yangilangan.
    await openMainCashbox(page);
    await openSpendDialog(page);
    await categoryCombobox(page).click();
    const options = page.getByRole("listbox", { name: "Xarajat kategoriyalari" }).getByRole("option");
    await expect(options).toHaveCount(17);
    await expect(options.filter({ hasText: "Bank xizmati" })).toHaveCount(1);
    await expect(options.filter({ hasText: "Qaytarilgan pullar" })).toHaveCount(0);
    await expect(options.filter({ hasText: "Yoqilg'i va moy" })).toHaveCount(1);
    expect(leaked).toEqual([]);
  });

  test("tanlangan kategoriya boshqa joyda o'chirilsa: 400 matni, tanlov tozalanadi, boshqasi tanlanib qayta yuboriladi", async ({ page }) => {
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

    // Eskirgan tanlovsiz qayta yuborib bo'lmaydi — avval boshqa kategoriya.
    await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await expect(dialog.getByText("Xarajat kategoriyasini tanlang")).toBeVisible();
    await categoryCombobox(page).click();
    await page.getByRole("option", { name: /^Texnika va jihozlar/ }).click();
    await dialog.getByRole("button", { name: "Xarajatni saqlash" }).click();
    await page.getByRole("alertdialog", { name: "Xarajatni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();
    await expectToast(page, "Xarajat muvaffaqiyatli saqlandi", { tone: "success" });
    expect(calls.spends.map((call) => call.status)).toEqual([400, 200]);
    expect(calls.spends[1].body).toHaveProperty("expense_category_id", "12");
    expect(calls.spends[1].key).toBe(calls.spends[0].key);
  });
});
