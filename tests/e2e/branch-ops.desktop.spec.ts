import { expect, test } from "@playwright/test";
import { mockBranchOpsApi, openBranchOps } from "./support/branchOps";

/**
 * FILIALLAR — OPERATSIYALAR (/branch-ops): jadval konvertdan ochiladi;
 * partiyani bekor qilish faqat ≥10 belgili sabab bilan; 400 xabari ko'rinadi.
 */
for (const width of [1920, 1440]) {
  test.describe(`Filiallar — operatsiyalar — ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 90_000 });

    test("⭐ jadvalda yangi buyurtmali filiallar (\"Ma'lumot topilmadi\" emas)", async ({ page }) => {
      const { leaked } = await mockBranchOpsApi(page);
      await openBranchOps(page);
      const rows = page.locator(".ant-table-tbody tr.ant-table-row");
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText("Urganch filiali");
      await expect(rows.nth(0)).toContainText("7");
      await expect(rows.nth(1)).toContainText("Xiva filiali");
      await expect(page.locator(".ant-empty")).toHaveCount(0);
      expect(leaked).toEqual([]);
    });

    test("⭐ sabab < 10 belgi — tugma o'chiq; ≥ 10 — { reason } yuboriladi, muvaffaqiyat xabari", async ({ page }) => {
      const { leaked, cancelBodies } = await mockBranchOpsApi(page, {
        cancel: () => ({ status: 200, body: { statusCode: 200, message: "Batch cancelled", data: { id: "18" } } }),
      });
      await openBranchOps(page);
      const button = page.getByRole("button", { name: "Batchni bekor qilish" });

      await page.getByLabel("batch-id").fill("18");
      await page.getByLabel("Bekor qilish sababi").fill("qisqa");
      await expect(page.getByText(/kamida 10 ta belgidan iborat/)).toBeVisible();
      await expect(button).toBeDisabled();

      await page.getByLabel("Bekor qilish sababi").fill("Noto'g'ri viloyatga yuborilgan");
      await expect(button).toBeEnabled();
      await button.click();
      await page.getByRole("button", { name: "Ha, bekor qilish" }).click();

      await expect(page.getByText("Partiya muvaffaqiyatli bekor qilindi")).toBeVisible();
      expect(cancelBodies).toEqual([{ reason: "Noto'g'ri viloyatga yuborilgan" }]);
      expect(leaked).toEqual([]);
    });

    test("⭐ backend 400 — server xabari xato Alert'ida ko'rinadi", async ({ page }) => {
      const { leaked } = await mockBranchOpsApi(page, {
        cancel: () => ({
          status: 400,
          body: { statusCode: 400, message: "Faqat SENT holatdagi partiyani bekor qilish mumkin" },
        }),
      });
      await openBranchOps(page);
      await page.getByLabel("batch-id").fill("18");
      await page.getByLabel("Bekor qilish sababi").fill("Noto'g'ri viloyatga yuborilgan");
      await page.getByRole("button", { name: "Batchni bekor qilish" }).click();
      await page.getByRole("button", { name: "Ha, bekor qilish" }).click();

      const alert = page.locator(".ant-alert-error");
      await expect(alert).toContainText("Partiyani bekor qilib bo'lmadi");
      await expect(alert).toContainText("Faqat SENT holatdagi partiyani bekor qilish mumkin");
      expect(leaked).toEqual([]);
    });
  });
}
