import { expect, test } from "@playwright/test";
import { expectToast } from "./support/toast";
import { createHqWarehouse, mockWarehouseHqApi, openCreateDialog, stockInOneProduct } from "./support/warehouseHq";

/**
 * Markaziy ombor (Trello Pa1KaXmj, ega qarori 2026-10-25; 1-bosqich — ombor ochish + kirim, buyurtma oqimiga
 * tegilmaydi), 1440px. Maket yo'q — eng yaqini `superadmin-warehouse-create-dialog` / `superadmin-warehouse-list` /
 * `superadmin-warehouse-detail`.
 */
test.describe("Markaziy ombor — ochish va kirim (superadmin, desktop)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("oyna → «Markaziy ombor · Toshkent HQ» → yaratish (mas'ulsiz) → tafsilot → kirim → ro'yxatda tepada", async ({ page }) => {
    const mock = await mockWarehouseHqApi(page);
    const heading = await createHqWarehouse(page);
    await expectToast(page, "Ombor ochildi", { tone: "success" });
    expect(mock.created).toEqual([{ branch_id: "1", name: "Markaziy ombor", low_stock_default: 5 }]);

    const header = page.locator("header").filter({ has: heading });
    await expect(header.getByText("Markaziy", { exact: true })).toBeVisible();
    await expect(header.getByText("Markaziy ombor · HQ")).toBeVisible();
    await expect(header.getByText("Mas'ul: belgilanmagan")).toBeVisible();
    await expect(page.getByText(/Markaziy ombor qoldig'i buyurtmalarga keyingi bosqichda ulanadi/)).toBeVisible();

    await stockInOneProduct(page);
    await expectToast(page, "Qoldiqqa qo'shildi", { tone: "success" });
    expect(mock.stockIns).toHaveLength(1);
    expect(mock.stockIns[0].body).toMatchObject({ lines: [{ product_id: "142", qty: 1 }] });
    expect(mock.stockIns[0].key).toBeTruthy();
    await expect(page.getByRole("table", { name: "Ombordagi mahsulotlar" }).getByText("Simsiz quloqchin")).toBeVisible();

    // «← Omborlar»: Markaziy ombor qatori tepada, «Markaziy» belgisi bilan, viloyati — HQ filialiniki (filtr bilan bir xil).
    await page.getByRole("link", { name: /Omborlar/ }).first().click();
    const table = page.getByRole("table", { name: "Omborlar" });
    const firstRow = table.getByRole("row").nth(1);
    await expect(firstRow.getByRole("link", { name: "Markaziy ombor" })).toBeVisible();
    await expect(firstRow.getByText("Markaziy", { exact: true })).toBeVisible();
    await expect(firstRow.getByRole("cell", { name: "Toshkent shahri", exact: true })).toBeVisible();
    await expect(table.getByRole("row").nth(2).getByRole("link", { name: "Samarqand filiali ombori" })).toBeVisible();
    expect(mock.leaked).toEqual([]);
  });

  test("`GET /branches/hq` 404 (tizimda HQ yo'q) — oyna avvalgidek, faqat viloyat filiallari", async ({ page }) => {
    const mock = await mockWarehouseHqApi(page, { hq: "missing" });
    await openCreateDialog(page);
    await expect(page.getByRole("option")).toHaveText(["Qarshi filiali · Qashqadaryo viloyati"]);
    expect(mock.leaked).toEqual([]);
  });
});
