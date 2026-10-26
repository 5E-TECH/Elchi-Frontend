import { expect, test } from "@playwright/test";
import { mockStatusCountsApi } from "./support/ordersStatusCounts";

/**
 * vbu7Wr3o — menejer ro'yxatidagi sotish oynasi (1440): «Marketga to'langan summa · 25 000 so'mdan oshmasin» — chegara
 * ro'yxat qatoridagi `sale_market_paid_max` dan (ilgari oynaga ko'chirilmasdi → `to_be_paid` 0 → «0 so'mdan oshmasin»).
 */
test.describe("Menejer sotish oynasi — market to'lovi chegarasi (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ vbu7Wr3o: menejer sotish oynasi — «Marketga to'langan summa · 25 000 so'mdan oshmasin» (0 emas)", async ({ page }, testInfo) => {
    const { leaked } = await mockStatusCountsApi(page, "manager");
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /133 ni sotish$/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Buyurtmani sotish" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/25[\s\u00a0\u202f]000 so'mdan oshmasin/);
    await expect(dialog).not.toContainText(/·\s*0 so'mdan oshmasin/);
    await testInfo.attach("manager-sell-limit-1440", { body: await page.screenshot(), contentType: "image/png" });
    expect(leaked).toEqual([]);
  });
});
