import { expect, test, type Page } from "@playwright/test";
import { fillMarketTransfer, mockManagerMarketPayments, noHorizontalScroll } from "./support/managerMarketPayments";

/**
 * Menejer — marketga (ega 2026-11-11), 390px: market kassasidagi «Marketga to'lov» — toshishsiz, bosiladigan narsalar
 * ≥ 44 px, tasdiq oynasi pastki varaqa; so'rov — filial kartasi bilan.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.describe("Menejer — marketga to'lov, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: O'tkazma + filial kartasi — toshishsiz, ≥ 44 px, so'rov ketadi`, async ({ page }) => {
      const { payments, leaked } = await mockManagerMarketPayments(page, { theme });
      await page.goto("/payments/cash-detail/2?type=market");
      await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toBeVisible({ timeout: 60_000 });
      await page.getByRole("radio", { name: "O'tkazma", exact: true }).click();
      for (const target of [
        page.getByRole("radio", { name: "Naqd" }),
        page.getByRole("combobox", { name: /Qaysi kartadan/ }),
        page.getByRole("button", { name: "To'lash" }),
      ]) {
        const box = (await target.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
      }
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `manager-market-pay-390-${theme}`);

      const confirm = await fillMarketTransfer(page, "200000", /Humo Agrobank/);
      await expect(confirm).toContainText("Filial kassasi");
      await confirm.getByRole("button", { name: "Tasdiqlash" }).click();
      await expect.poll(() => payments.length).toBe(1);
      expect(payments[0].body).toEqual(expect.objectContaining({ market_id: "2", payment_method: "click", card_id: "6" }));
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(leaked).toEqual([]);
    });
  }
});
