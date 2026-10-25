import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./support/scannerCamera";
import { expectToast } from "./support/toast";
import { createHqWarehouse, mockWarehouseHqApi, openCreateDialog, stockInOneProduct } from "./support/warehouseHq";

/**
 * Markaziy ombor (Trello Pa1KaXmj, 1-bosqich) — 390px: oyna pastki varaqa, gorizontal skroll yo'q, ro'yxat kartalarida
 * Markaziy ombor birinchi. Maket yo'q — eng yaqini `superadmin-warehouse-create-dialog` / `superadmin-warehouse-list`.
 */
test.describe("Markaziy ombor — ochish va kirim (superadmin, 390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("oyna → Markaziy ombor → yaratish → kirim → kartalarda birinchi", async ({ page }) => {
    const mock = await mockWarehouseHqApi(page);
    await openCreateDialog(page);
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");

    const heading = await createHqWarehouse(page);
    await expectToast(page, "Ombor ochildi", { tone: "success" });
    expect(mock.created).toEqual([{ branch_id: "1", name: "Markaziy ombor", low_stock_default: 5 }]);
    const header = page.locator("header").filter({ has: heading });
    await expect(header.getByText("Markaziy", { exact: true })).toBeVisible();
    await expect(header.getByText("Markaziy ombor · HQ")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await stockInOneProduct(page);
    await expectToast(page, "Qoldiqqa qo'shildi", { tone: "success" });
    expect(mock.stockIns).toHaveLength(1);
    expect(mock.stockIns[0].body).toMatchObject({ lines: [{ product_id: "142", qty: 1 }] });

    await page.getByRole("link", { name: /Omborlar/ }).first().click();
    const cards = page.getByRole("list", { name: "Omborlar" }).getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText("Markaziy ombor");
    await expect(cards.first().getByText("Markaziy", { exact: true })).toBeVisible();
    await expect(cards.nth(1)).toContainText("Samarqand filiali ombori");
    await expectNoHorizontalScroll(page);
    expect(mock.leaked).toEqual([]);
  });
});
