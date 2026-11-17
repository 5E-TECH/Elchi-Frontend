import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, mockBatchesApi } from "./support/batches";

/**
 * PAKETNI BEKOR QILISH (oP02jE2P) — 390px: sarlavhadagi tugma to'liq enli va ≥ 44 px, oyna — pastki varaqa,
 * gorizontal aylanish yo'q; 400 (noma'lum sabab) — backend matni «(400)» siz.
 */
test.describe("Paketni bekor qilish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ to'liq enli tugma, pastki varaqa, 400 — backend matni holat kodisiz", async ({ page }) => {
    const { leaked, cancels } = await mockBatchesApi(page, {
      cancel: () => ({ status: 400, body: { statusCode: 400, message: "Partiya holati mos emas (400)" } }),
    });
    await page.goto("/batches/172");
    await expect(page.getByRole("heading", { level: 1, name: "Paket B-172" })).toBeVisible({ timeout: 60_000 });
    await expectNoHorizontalScroll(page);

    const button = page.getByRole("button", { name: "Paketni bekor qilish" });
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    // To'liq enli (16 px chekkalar bilan): kamida 390 − 2·16 − 2 px.
    expect(box.width).toBeGreaterThanOrEqual(390 - 34);
    await button.click();

    const dialog = page.getByRole("alertdialog", { name: "Paketni bekor qilasizmi?" });
    await expect(dialog).toBeVisible();
    // Pastki varaqa: oyna ekran pastiga yopishgan.
    const sheet = (await dialog.boundingBox())!;
    expect(Math.round(sheet.y + sheet.height)).toBeGreaterThanOrEqual(844 - 2);

    await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Noto'g'ri filialga yig'ilgan");
    await dialog.getByRole("button", { name: "Paketni bekor qilish" }).click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("Paketni bekor qilib bo'lmadi");
    await expect(alert).toContainText("Partiya holati mos emas");
    await expect(alert).not.toContainText("(400)");
    await expect(dialog.getByRole("button", { name: "Paketni bekor qilish" })).toBeEnabled();
    expect(cancels).toHaveLength(1);
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});
