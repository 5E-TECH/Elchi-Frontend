import { expect, test, type Page } from "@playwright/test";
import { fillMarketTransfer, mockManagerMarketPayments, noHorizontalScroll } from "./support/managerMarketPayments";

/**
 * Menejer — marketga (ega 2026-11-11), 390px: market kassasidagi «Marketga to'lov» — toshishsiz, bosiladigan narsalar
 * ≥ 44 px, tasdiq oynasi pastki varaqa; P0 63HO6cBU (ega Q1): faqat summa — usul va karta yo'q. BE PR-C: «Berilishi
 * kerak» — o'z filiali marketlari, summa «To'lash mumkin» (`payable`), 0 — tanlanmaydi; so'rovda `payment_method` yo'q.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.describe("Menejer — marketga to'lov, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: «Berilishi kerak» varaqasi — «To'lash mumkin», 0 tanlanmaydi, qatorlar ≥ 44 px`, async ({ page }) => {
      const mock = await mockManagerMarketPayments(page, { theme });
      await page.goto("/payments");
      await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
      const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
      const baraka = picker.getByRole("option", { name: /Baraka Shop/ });
      await expect(baraka).toContainText(/1\s250\s000 so'm/);
      const oila = picker.getByRole("option", { name: /Oila Market/ });
      await expect(oila).toHaveAttribute("aria-disabled", "true");
      for (const target of [baraka, oila, picker.getByRole("button", { name: "Tanlash" })]) {
        const box = (await target.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
      }
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(mock.marketsListCalls()).toBe(0);
      await shot(page, `manager-market-picker-390-${theme}`);
    });

    test(`⭐ ${theme}: faqat summa — toshishsiz, ≥ 44 px, so'rov ketadi (payment_method yo'q)`, async ({ page }) => {
      const { payments, leaked } = await mockManagerMarketPayments(page, { theme });
      await page.goto("/payments/cash-detail/2?type=market");
      await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/^To'lash mumkin: 1\s250\s000 so'm$/)).toBeVisible();
      await expect(page.getByRole("radio", { name: "O'tkazma", exact: true })).toHaveCount(0);
      for (const target of [page.getByRole("textbox", { name: /^Summa/ }), page.getByRole("button", { name: "To'lash" })]) {
        const box = (await target.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
      }
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `manager-market-pay-390-${theme}`);

      const confirm = await fillMarketTransfer(page, "200000");
      await expect(confirm).toContainText("Filial kassasi");
      await confirm.getByRole("button", { name: "Tasdiqlash" }).click();
      await expect.poll(() => payments.length).toBe(1);
      expect(payments[0].body).toEqual(expect.objectContaining({ market_id: "2", amount: 200_000 }));
      expect(payments[0].body).not.toHaveProperty("payment_method");
      expect(payments[0].body).not.toHaveProperty("card_id");
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(leaked).toEqual([]);
    });
  }
});
