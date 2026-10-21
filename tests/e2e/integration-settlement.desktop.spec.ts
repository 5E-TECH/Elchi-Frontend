import { expect, test } from "@playwright/test";
import { OVERPAID_RESPONSE, REMITTANCES, mockSettlementApi, openSettlement } from "./support/integrationSettlement";

/**
 * Integratsiya → Hisob-kitob (IS-1, N3yNa6rO): «To'lov olindi» summasi ASOSIY KASSAGA o'zi yoziladi — panel buni
 * aytadi (eski «Bu ekran kassa emas» o'rniga), «Qoldiq» to'lanishi kerak / avans bilan, oyna «to'lanishi kerak».
 */
test.describe("Integratsiya — Hisob-kitob, desktop", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const role of ["superadmin", "admin"] as const) {
    test(`⭐ ${role}: kassa matni, «Qoldiq» va to'lov oynasi`, async ({ page }) => {
      const { remittances, leaked } = await mockSettlementApi(page, { role });
      await openSettlement(page);

      await expect(page.getByText(/kassa emas/i)).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Asosiy kassaga" })).toHaveAttribute("href", "/payments/main-cashbox");

      const balance = page.getByRole("region", { name: "Qoldiq" });
      await expect(balance).toContainText(/To'lanishi kerak\s*4\s510\s000/);
      await expect(balance).toContainText("23 ta yozuv kutilmoqda");
      await expect(balance).toContainText(/Hamkor avansi\s*−350\s000 so'm/);

      await balance.getByRole("button", { name: "To'lov olindi" }).click();
      const dialog = page.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
      await expect(dialog).toContainText(/Tez Yetkaz · to'lanishi kerak 4\s510\s000 so'm/);
      await expect(dialog).toContainText("Summa asosiy kassaga kirim bo'ladi");
      await expect(dialog.getByText("Kassaga yozilmaydi")).toHaveCount(0);

      await dialog.getByRole("textbox", { name: /Summa/ }).fill("1500000");
      await dialog.getByRole("textbox", { name: /To'lov raqami yoki chek/ }).fill("To'lov topshiriqnomasi №4518");
      await dialog.getByRole("button", { name: "Yozish" }).click();
      await expect(dialog).toHaveCount(0);
      // IS-2: qarzga aniq tushdi va kassaga yozildi — natija oynasi emas, xabar.
      await expect(page.getByText("To'lov yozildi", { exact: true })).toBeVisible();
      await expect(page.getByText(/^3 ta qarz yopildi · Asosiy kassaga 1\s500\s000 so'm kirim$/)).toBeVisible();
      await expect(page.getByRole("dialog", { name: "To'lov yozildi" })).toHaveCount(0);
      expect(remittances).toEqual([{ amount: 1_500_000, reference: "To'lov topshiriqnomasi №4518" }]);
      expect(leaked).toEqual([]);
    });

    test(`⭐ ${role}: ortiqcha summa — ogohlantirish, tenglash, natija oynasi (IS-2)`, async ({ page }) => {
      const { remittances, leaked } = await mockSettlementApi(page, { role, remittanceResponse: OVERPAID_RESPONSE });
      await openSettlement(page);

      // «Qarz yozuvlari» — «To'lov» ustuni.
      const rows = page.getByRole("table", { name: "Qarz yozuvlari" });
      await expect(rows.getByRole("columnheader", { name: "To'lov" })).toBeVisible();
      await expect(rows.getByRole("row", { name: /№10209/ })).toContainText("To'lov №82");

      await page.getByRole("button", { name: "To'lov olindi" }).click();
      const dialog = page.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
      await expect(dialog).toContainText(/to'lanishi kerak 4\s510\s000 so'm/);
      const amount = dialog.getByRole("textbox", { name: /Summa/ });
      await amount.fill("5000000");
      await expect(dialog).toContainText(/To'lanishi kerak bo'lgandan 490\s000 so'm ortiq/);
      await expect(dialog).toContainText("Ortig'i hamkor avansiga o'tadi");
      await expect(dialog).toContainText(/Barcha 23 ta qarz yopiladi, Tez Yetkaz avansi 490\s000 so'm bo'ladi/);
      await expect(dialog.getByText("Summa asosiy kassaga kirim bo'ladi")).toHaveCount(0);

      // Tenglash — summa to'lanishi kerakka, ogohlantirish yo'qoladi; qayta ortiqcha summa — yozish bloklanmaydi.
      await dialog.getByRole("button", { name: /Summani 4\s510\s000 so'mga tenglash/ }).click();
      await expect(amount).toHaveValue(/^4\s510\s000$/);
      // Tenglash tugmasi yo'qoladi — fokus oynadan chiqib ketmaydi, summa maydonida.
      await expect(amount).toBeFocused();
      await expect(dialog.getByText("Ortig'i hamkor avansiga o'tadi")).toHaveCount(0);
      await amount.fill("5000000");
      await dialog.getByRole("button", { name: "Yozish" }).click();
      await expect(dialog).toHaveCount(0);

      const result = page.getByRole("dialog", { name: "To'lov yozildi" });
      await expect(result).toBeVisible();
      await expect(result).toContainText(/Tez Yetkaz · №84 · Bugun, \d{2}:\d{2}/);
      await expect(result).toContainText(/140\s000 so'm avansga o'tdi/);
      await expect(result).toContainText(/23 ta yozuv — hammasi/);
      await expect(result).toContainText(/Hamkor avansi endi\s*490\s000 so'm/);
      await expect(result).toContainText(/Kirim yozildi · 5\s000\s000 so'm/);
      await expect(result).not.toContainText("sig'madi");
      await expect(result.getByRole("link", { name: "Asosiy kassani ochish" })).toHaveAttribute("href", "/payments/main-cashbox");
      await result.getByRole("button", { name: "Tayyor" }).click();
      await expect(result).toHaveCount(0);
      // Fokus «To'lov olindi» ga qaytadi (to'lov oynasining yo'qolgan «Yozish» tugmasiga emas).
      await expect(page.getByRole("button", { name: "To'lov olindi" })).toBeFocused();

      expect(remittances).toEqual([{ amount: 5_000_000 }]);
      expect(leaked).toEqual([]);
    });
  }

  test("kassaga yozilmadi — natija oynasida ogohlantirish va Asosiy kassa havolasi", async ({ page }) => {
    const { leaked } = await mockSettlementApi(page, {
      remittanceResponse: { remittance_id: 90, remitted_amount: 1_500_000, settled_amount: 1_500_000, settled_count: 6, unapplied_amount: 0, advance_applied: 0, advance_balance: 350_000, cashbox_posted: false },
    });
    await openSettlement(page);
    await page.getByRole("button", { name: "To'lov olindi" }).click();
    const dialog = page.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
    await dialog.getByRole("textbox", { name: /Summa/ }).fill("1500000");
    await dialog.getByRole("button", { name: "Yozish" }).click();

    const result = page.getByRole("dialog", { name: "To'lov yozildi" });
    await expect(result).toContainText("Kassaga yozilmadi");
    const alert = result.getByRole("alert");
    await expect(alert).toContainText("Summa asosiy kassaga tushmadi");
    await expect(alert.getByRole("link", { name: "Asosiy kassa" })).toHaveAttribute("href", "/payments/main-cashbox");
    expect(leaked).toEqual([]);
  });

  for (const role of ["superadmin", "admin"] as const) {
    test(`⭐ ${role}: «Olingan to'lovlar» — jadval, kassa yorliqlari, filtr (IS-3)`, async ({ page }) => {
      const { remittanceQueries, leaked } = await mockSettlementApi(page, { role });
      await openSettlement(page);

      const section = page.getByRole("region", { name: "Olingan to'lovlar" });
      const table = section.getByRole("table", { name: "Olingan to'lovlar" });
      for (const name of ["Sana", "Summa", "Yopilgan qarzlar", "To'lov raqami · izoh", "Holat · kassa"]) {
        await expect(table.getByRole("columnheader", { name })).toBeVisible();
      }
      const row82 = table.getByRole("row", { name: /№82/ });
      await expect(row82).toContainText(/1\s500\s000 so'm/);
      await expect(row82).toContainText(/1 ta qarz/);
      await expect(row82).toContainText(/350\s000 so'm avansga o'tdi/);
      await expect(row82).toContainText("To'lov topshiriqnomasi №4518");
      await expect(row82).toContainText("Faol");
      await expect(row82).toContainText("Kassaga yozildi");
      await expect(table.getByRole("row", { name: /№79/ })).toContainText(/Kassaga yozilmadi\s*Asosiy kassa tarixini tekshiring/);
      const row77 = table.getByRole("row", { name: /№77/ });
      await expect(row77).toContainText("7 ta qarz qayta ochildi");
      await expect(row77).toContainText("Kassadan qaytarildi");
      await expect(row77).toContainText("«Summa xato: 500 000 o'rniga 5 000 000»");
      await expect(row77.getByRole("button", { name: /bekor qilish/ })).toHaveCount(0);
      await expect(table.getByRole("row", { name: /№61/ })).toContainText("Kassa: eski yozuv");
      // Muallif ismi — Taklif (backend id beradi): chizilmaydi.
      await expect(section).not.toContainText("Shodiyor");

      await section.getByRole("button", { name: "Bekor qilingan" }).click();
      await expect(table.getByRole("row")).toHaveCount(2);
      expect(remittanceQueries.at(-1)).toMatchObject({ status: "cancelled", page: "1" });
      await section.getByRole("button", { name: "Barchasi" }).click();
      await expect(table.getByRole("row")).toHaveCount(REMITTANCES.length + 1);

      // «Qarz yozuvlari» dagi «To'lov №82» — bo'limga o'tadi (URL o'zgarmaydi).
      const before = page.url();
      await page.getByRole("table", { name: "Qarz yozuvlari" }).getByRole("button", { name: "To'lov №82" }).click();
      await expect(page.locator("[data-remittances-head]")).toBeFocused();
      expect(page.url()).toBe(before);
      expect(leaked).toEqual([]);
    });

    test(`⭐ ${role}: to'lovni bekor qilish — oqibatlar, sabab, xabar (IS-3)`, async ({ page }) => {
      const { cancels, leaked } = await mockSettlementApi(page, { role });
      await openSettlement(page);

      const section = page.getByRole("region", { name: "Olingan to'lovlar" });
      await section.getByRole("button", { name: "№82 to'lovini bekor qilish" }).click();
      const dialog = page.getByRole("alertdialog", { name: "To'lovni bekor qilasizmi?" });
      await expect(dialog).toContainText(/№82 · 1\s500\s000 so'm · /);
      await expect(dialog).toContainText(/1 ta qarz qaytadan «Kutilmoqda» bo'ladi — Tez Yetkaz qarzi 1\s150\s000 so'mga ortadi/);
      await expect(dialog).toContainText(/Asosiy kassadan 1\s500\s000 so'm teskari chiqim yoziladi/);
      await expect(dialog).toContainText(/Shu to'lovdan qolgan 350\s000 so'm avans ham bekor bo'ladi/);
      await expect(dialog).toContainText("«Bekor qilingan · Kassadan qaytarildi»");
      // Fokus xavfsiz tugmada.
      await expect(dialog.getByRole("button", { name: "Orqaga" })).toBeFocused();

      await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
      await expect(dialog).toContainText("Sababni yozing");
      expect(cancels).toEqual([]);

      await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Summa ikki marta kiritilgan");
      await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("To'lov bekor qilindi", { exact: true })).toBeVisible();
      await expect(page.getByText(/^1 ta qarz qayta ochildi · kassadan 1\s500\s000 so'm qaytarildi$/)).toBeVisible();
      expect(cancels).toEqual([{ id: "82", body: { reason: "Summa ikki marta kiritilgan" } }]);
      expect(leaked).toEqual([]);
    });
  }

  test("eski yozuv — kassa tanlovi majburiy, `reverse_cashbox` yuboriladi", async ({ page }) => {
    const { cancels, leaked } = await mockSettlementApi(page);
    await openSettlement(page);
    await page.getByRole("button", { name: "№61 to'lovini bekor qilish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "To'lovni bekor qilasizmi?" });
    await expect(dialog.getByRole("group", { name: /Bu to'lov asosiy kassaga kirim qilinganmi/ })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Asosiy kassa" })).toHaveAttribute("href", "/payments/main-cashbox");
    await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Pul kassaga kiritilmagan edi");
    await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
    await expect(dialog).toContainText("Kassa bo'yicha javobni tanlang");
    expect(cancels).toEqual([]);
    await dialog.getByRole("radio", { name: /Yo'q — kassa o'zgarmasin/ }).check();
    await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
    await expect(dialog).toHaveCount(0);
    expect(cancels).toEqual([{ id: "61", body: { reason: "Pul kassaga kiritilmagan edi", reverse_cashbox: false } }]);
    expect(leaked).toEqual([]);
  });

  test("409 — «Hozir bekor qilib bo'lmaydi» (xom matnsiz), tasdiqlash o'chiq", async ({ page }) => {
    const raw409 = "Bu to'lovdan qolgan avansning 140000 so'mi keyingi to'lov(lar)da qarz yopishga ishlatilgan (#85)";
    const { leaked } = await mockSettlementApi(page, {
      cancelResponse: { status: 409, body: { statusCode: 409, message: raw409 } },
    });
    await openSettlement(page);
    await page.getByRole("button", { name: "№82 to'lovini bekor qilish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "To'lovni bekor qilasizmi?" });
    await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Xato");
    await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Hozir bekor qilib bo'lmaydi");
    await expect(dialog).not.toContainText("#85");
    await expect(dialog.getByRole("button", { name: "To'lovni bekor qilish" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Orqaga" }).click();
    await expect(dialog).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("502 — kassa xatosi oyna ichida, oyna ochiq qoladi", async ({ page }) => {
    const { leaked } = await mockSettlementApi(page, {
      cancelResponse: { status: 502, body: { statusCode: 502, message: "Kassadan teskari chiqim yozilmadi — to'lov bekor qilinmadi: x" } },
    });
    await openSettlement(page);
    await page.getByRole("button", { name: "№82 to'lovini bekor qilish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "To'lovni bekor qilasizmi?" });
    await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Xato");
    await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/Kassadan chiqim yozib bo'lmadi\s*To'lov, qarzlar va kassa avvalgidek qoldi/);
    await expect(dialog).not.toContainText("teskari chiqim yozilmadi");
    await expect(dialog.getByRole("button", { name: "To'lovni bekor qilish" })).toBeEnabled();
    expect(leaked).toEqual([]);
  });
});
