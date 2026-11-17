import { expect, test } from "@playwright/test";
import { branchRows, mockBranchOpsApi, openBranchOps } from "./support/branchOps";

/**
 * FILIALLAR — OPERATSIYALAR (/batches, dizayn v2 — maket `superadmin-ops-branches`): jadval konvertdan ochiladi,
 * qator — filial sahifasiga havola. oP02jE2P: qo'lda paket raqami bilan bekor qilish formasi yo'q — bekor qilish
 * faqat paket sahifasida (`batch-cancel.*.spec.ts`).
 */
for (const width of [1920, 1440]) {
  test.describe(`Filiallar — operatsiyalar — ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 90_000 });

    test("⭐ jadvalda yangi buyurtmali filiallar (bo'sh holat emas), bekor qilish formasi yo'q", async ({ page }) => {
      const { leaked } = await mockBranchOpsApi(page);
      await openBranchOps(page);
      const rows = branchRows(page);
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText("Urganch filiali");
      await expect(rows.nth(0)).toContainText("7 ta");
      await expect(rows.nth(1)).toContainText("Xiva filiali");
      await expect(page.getByText("Yangi buyurtmali filial yo'q")).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: /Paket ID/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Paketni bekor qilish" })).toHaveCount(0);
      await expect(page).toHaveURL(/\/batches$/);
      expect(leaked).toEqual([]);
    });

    test("qator — filial sahifasi (/branches/:id)", async ({ page }) => {
      const { leaked } = await mockBranchOpsApi(page);
      await openBranchOps(page);
      await expect(branchRows(page).nth(0).getByRole("link", { name: "Urganch filiali" })).toHaveAttribute(
        "href",
        "/branches/12",
      );
      await branchRows(page).nth(1).getByText("2 ta").click();
      await expect(page).toHaveURL(/\/branches\/15$/);
      expect(leaked).toEqual([]);
    });
  });
}
