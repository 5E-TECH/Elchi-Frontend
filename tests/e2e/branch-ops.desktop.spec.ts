import { expect, test } from "@playwright/test";
import {
  batchIdInput,
  branchRows,
  cancelBatchButton,
  confirmBatchCancel,
  mockBranchOpsApi,
  openBranchOps,
  reasonInput,
} from "./support/branchOps";

/**
 * FILIALLAR — OPERATSIYALAR (/branch-ops, dizayn v2 — maket `superadmin-ops-branches`): jadval konvertdan ochiladi;
 * paketni bekor qilish faqat ≥10 belgili sabab bilan va tasdiqdan keyin; 400 xabari ko'rinadi.
 */
for (const width of [1920, 1440]) {
  test.describe(`Filiallar — operatsiyalar — ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 90_000 });

    test("⭐ jadvalda yangi buyurtmali filiallar (bo'sh holat emas)", async ({ page }) => {
      const { leaked } = await mockBranchOpsApi(page);
      await openBranchOps(page);
      const rows = branchRows(page);
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText("Urganch filiali");
      await expect(rows.nth(0)).toContainText("7 ta");
      await expect(rows.nth(1)).toContainText("Xiva filiali");
      await expect(page.getByText("Yangi buyurtmali filial yo'q")).toHaveCount(0);
      await expect(page.getByRole("main").getByRole("link", { name: "Ops vositalari" })).toHaveAttribute("href", "/ops?tab=branches");
      expect(leaked).toEqual([]);
    });

    test("⭐ sabab < 10 belgi — tugma o'chiq; ≥ 10 — { reason } yuboriladi, muvaffaqiyat xabari", async ({ page }) => {
      const { leaked, cancelBodies } = await mockBranchOpsApi(page, {
        cancel: () => ({ status: 200, body: { statusCode: 200, message: "Batch cancelled", data: { id: "18" } } }),
      });
      await openBranchOps(page);
      const button = cancelBatchButton(page);

      await batchIdInput(page).fill("18");
      await reasonInput(page).fill("qisqa");
      await expect(page.getByText(/kamida 10 ta belgidan iborat/)).toBeVisible();
      await expect(button).toBeDisabled();

      await reasonInput(page).fill("Noto'g'ri viloyatga yuborilgan");
      await expect(page.getByText("30 ta belgi · kamida 10 ta")).toBeVisible();
      await expect(button).toBeEnabled();
      await button.click();
      expect(cancelBodies).toEqual([]); // tasdiqsiz so'rov ketmaydi
      await confirmBatchCancel(page);

      await expect(page.getByText("Paket muvaffaqiyatli bekor qilindi")).toBeVisible();
      expect(cancelBodies).toEqual([{ reason: "Noto'g'ri viloyatga yuborilgan" }]);
      expect(leaked).toEqual([]);
    });

    // LJt0G1y1: xom backend matni foydalanuvchiga chiqmaydi — ogohlantirishda o'z (i18n) matnimiz.
    test("⭐ backend 400 — xato ogohlantirishida i18n matn, server xabari emas", async ({ page }) => {
      const { leaked } = await mockBranchOpsApi(page, {
        cancel: () => ({
          status: 400,
          body: { statusCode: 400, message: "Faqat SENT holatdagi partiyani bekor qilish mumkin" },
        }),
      });
      await openBranchOps(page);
      await batchIdInput(page).fill("18");
      await reasonInput(page).fill("Noto'g'ri viloyatga yuborilgan");
      await cancelBatchButton(page).click();
      await confirmBatchCancel(page);

      const alert = page.getByRole("alert").filter({ hasText: "Paketni bekor qilib bo'lmadi" });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Ma'lumot qabul qilinmadi (400). Kiritilganini tekshirib, qayta urinib ko'ring.");
      await expect(alert).not.toContainText("Faqat SENT holatdagi partiyani bekor qilish mumkin");
      expect(leaked).toEqual([]);
    });
  });
}
