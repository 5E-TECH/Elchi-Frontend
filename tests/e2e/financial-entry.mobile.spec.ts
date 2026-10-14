import { expect, test } from "@playwright/test";
import { mockFinancialEntryApi, openHistoryTab, submitManualExpense } from "./support/financialEntry";

/** Balans → Tarix → "Yozuv qo'shish" (GtAoqHlk) — 390px. */
test.describe("Balans → Yozuv qo'shish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("oyna ekranga sig'adi, manual_expense → 201 va yangi yozuv tarixda", async ({ page }) => {
    const { posts, leaked } = await mockFinancialEntryApi(page);
    await openHistoryTab(page);

    const dialog = await submitManualExpense(page, "Ofis ijarasi");
    const box = (await dialog.locator("form").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    const save = dialog.getByRole("button", { name: "Saqlash" });
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const response = page.waitForResponse(
      (res) => res.url().endsWith("/finance/financial-balance/entries") && res.request().method() === "POST",
    );
    await save.click();
    expect((await response).status()).toBe(201);
    expect(posts[0].body).toEqual({ amount: -1000, source_type: "manual_expense", comment: "Ofis ijarasi" });
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Ofis ijarasi").first()).toBeVisible();

    const main = await page.locator("main.el-surface-page").evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(main.sw).toBeLessThanOrEqual(main.cw);
    expect(leaked).toEqual([]);
  });
});
