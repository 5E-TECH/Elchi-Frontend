import { expect, test } from "@playwright/test";
import { OVERPAID_RESPONSE, mockSettlementApi, openSettlement } from "./support/integrationSettlement";

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
});
