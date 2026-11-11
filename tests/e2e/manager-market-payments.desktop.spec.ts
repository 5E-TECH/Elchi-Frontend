import { expect, test, type Page } from "@playwright/test";
import { fillMarketTransfer, mockManagerMarketPayments, noHorizontalScroll } from "./support/managerMarketPayments";

/**
 * Menejer — marketga (ega Bahodir 2026-11-11, BeePost kabi), 1440px: «To'lovlar» → «Marketga to'lov» → «Berilishi
 * kerak» → market kassasi — o'z filiali kassasidan (O'tkazma — filial kartasi); kuryerdan qabulda «Marketga o'tkazma»
 * (filial kassasiga kirim + marketga chiqim). Hozirgi backend menejerga 403 — tushunarli o'zbekcha xabar.
 * Maket yo'q — eng yaqini `superadmin-payments-cash-detail-market`, `superadmin-payments-to-give-dialog`.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Menejer — marketga to'lov, 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: «Marketga to'lov» → «Berilishi kerak» → market; O'tkazma + filial kartasi → so'rov`, async ({ page }) => {
      const { payments, leaked } = await mockManagerMarketPayments(page, { theme });
      await page.goto("/payments");
      await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
      const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
      await expect(picker.getByRole("option", { name: /Baraka Shop/ })).toBeVisible();
      await picker.getByRole("option", { name: /Baraka Shop/ }).dblclick();
      await expect(page).toHaveURL(/\/payments\/cash-detail\/2\?type=market$/);
      await expect(page.getByText("Pul filial kassasidan marketga o'tkaziladi")).toBeVisible({ timeout: 60_000 });

      const confirm = await fillMarketTransfer(page, "200000", /Humo Agrobank/);
      await expect(confirm).toContainText("Filial kassasi");
      await expect(confirm).toContainText("Urgut filiali");
      await expect(confirm).toContainText("Market kassasi");
      await expect(confirm).toContainText(/Karta\s*Humo Agrobank/);
      await expect(confirm).not.toContainText("Asosiy kassa");
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `manager-market-pay-1440-${theme}`);
      await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

      await expect.poll(() => payments.length).toBe(1);
      expect(payments[0].path).toBe("finance/cashbox/payment/market");
      expect(payments[0].body).toEqual(
        expect.objectContaining({ market_id: "2", amount: 200_000, payment_method: "click", card_id: "6" }),
      );
      expect(leaked).toEqual([]);
    });
  }

  test("kuryerdan qabul: «Marketga o'tkazma» → market; tasdiqda «Filial kassasi» va market; card_id yo'q", async ({ page }) => {
    const { payments, leaked } = await mockManagerMarketPayments(page);
    await page.goto("/payments/cash-detail/209?type=courier");
    await expect(page.getByRole("heading", { name: "Kuryerdan qabul qilish" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("textbox", { name: /^Summa/ }).fill("150000");
    await page.getByRole("radio", { name: "Marketga o'tkazma" }).click();
    await expect(page.getByRole("combobox", { name: /Qaysi kartaga/ })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Market" }).click();
    await page.getByRole("option", { name: "Baraka Shop" }).click();
    await page.getByRole("button", { name: /qabul qilish$/i }).click();
    const confirm = page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    await expect(confirm).toContainText("Filial kassasi");
    await expect(confirm).toContainText(/Market\s*Baraka Shop/);
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect.poll(() => payments.length).toBe(1);
    expect(payments[0].path).toBe("finance/cashbox/payment/courier");
    expect(payments[0].body).toEqual(
      expect.objectContaining({ courier_id: "209", amount: 150_000, payment_method: "click_to_market", market_id: "2" }),
    );
    expect(payments[0].body).not.toHaveProperty("card_id");
    expect(leaked).toEqual([]);
  });

  test("filial kassasi: tezkor amallarda «Marketga to'lov» — «Berilishi kerak» oynasi", async ({ page }) => {
    await mockManagerMarketPayments(page);
    await page.goto("/payments/main-cashbox");
    await page.getByRole("button", { name: /^Marketga to'lov/ }).click({ timeout: 60_000 });
    await expect(page.getByRole("dialog", { name: "Berilishi kerak" })).toBeVisible();
  });

  test("⭐ «Kartalar» oynasi (ega 2026-11-11): menejer o'z filiali kartalari orasida o'tkazadi — so'rov ketadi", async ({ page }) => {
    const { payments, leaked } = await mockManagerMarketPayments(page);
    await page.goto("/payments/main-cashbox");
    await page.getByRole("button", { name: /Karta \(Click\)/ }).first().click({ timeout: 60_000 });
    const cards = page.getByRole("dialog", { name: "Kartalar va hisob raqamlar" });
    await expect(cards.getByText(/Kartalarni qo'shish va tahrirlash — superadmin yoki admin/)).toBeVisible();
    await expect(cards.getByRole("button", { name: "Karta qo'shish" })).toHaveCount(0);
    await cards.getByRole("button", { name: "Kartalararo o'tkazma" }).click();
    const form = page.getByRole("dialog", { name: "Kartalararo o'tkazma" });
    await form.getByRole("combobox", { name: /Qaysi kartadan/ }).click();
    await page.getByRole("option", { name: /Uzcard Kapitalbank/ }).click();
    await form.getByRole("combobox", { name: /Qaysi kartaga/ }).click();
    await page.getByRole("option", { name: /Humo Agrobank/ }).click();
    await form.getByRole("textbox", { name: /^Summa/ }).fill("100000");
    await form.getByRole("textbox", { name: /^Sabab/ }).fill("Kun oxiri");
    await form.getByRole("button", { name: "O'tkazish" }).click();
    const confirm = page.getByRole("alertdialog", { name: "O'tkazmani tasdiqlang" });
    await confirm.getByRole("button", { name: "O'tkazish" }).click();

    await expect.poll(() => payments.length).toBe(1);
    expect(payments[0]).toEqual({
      path: "finance/cashbox/cards/transfer",
      body: { from_card_id: "5", to_card_id: "6", amount: 100_000, comment: "Kun oxiri" },
    });
    await expect(page.getByText("O'tkazma bajarildi", { exact: true }).first()).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("hozirgi backend (menejerga 403 «Forbidden resource») — «Bu to'lovga ruxsatingiz yo'q.»", async ({ page }) => {
    const { payments } = await mockManagerMarketPayments(page, { backend: "today" });
    await page.goto("/payments/cash-detail/2?type=market");
    const confirm = await fillMarketTransfer(page, "200000", /Humo Agrobank/);
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(page.getByText("Bu to'lovga ruxsatingiz yo'q.", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Forbidden resource")).toHaveCount(0);
    expect(payments).toHaveLength(1);
  });
});
