import { expect, test } from "@playwright/test";
import { mockSettlementApi, openSettlement } from "./support/integrationSettlement";

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
      expect(remittances).toEqual([{ amount: 1_500_000, reference: "To'lov topshiriqnomasi №4518" }]);
      expect(leaked).toEqual([]);
    });
  }
});
