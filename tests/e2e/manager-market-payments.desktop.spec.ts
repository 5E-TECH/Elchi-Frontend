import { expect, test, type Page } from "@playwright/test";
import { fillMarketTransfer, mockManagerMarketPayments, noHorizontalScroll } from "./support/managerMarketPayments";

/**
 * Menejer — marketga (ega Bahodir 2026-11-11, BeePost kabi), 1440px: «To'lovlar» → «Marketga to'lov» → «Berilishi
 * kerak» → market kassasi — o'z filiali kassasidan. P0 63HO6cBU (ega 2026-11-17): filial kassasi naqd/kartaga
 * bo'linmaydi — menejerda kuryerdan qabul ham, marketga to'lov ham faqat summa (usul va karta yo'q; marketga — PR-C
 * gacha payment_method "cash"); filial kassasida bitta jami, 2 ta amal, «Kartalar» oynasi yo'q. Hozirgi backend menejerga 403 — tushunarli
 * o'zbekcha xabar.
 * Maket yo'q — eng yaqini `superadmin-payments-cash-detail-market`, `superadmin-payments-to-give-dialog`.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Menejer — marketga to'lov, 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: «Marketga to'lov» → «Berilishi kerak» → market; faqat summa → so'rov (payment_method cash)`, async ({ page }) => {
      const { payments, leaked } = await mockManagerMarketPayments(page, { theme });
      await page.goto("/payments");
      await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
      const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
      await expect(picker.getByRole("option", { name: /Baraka Shop/ })).toBeVisible();
      await picker.getByRole("option", { name: /Baraka Shop/ }).dblclick();
      await expect(page).toHaveURL(/\/payments\/cash-detail\/2\?type=market$/);
      await expect(page.getByText("Pul filial kassasidan marketga o'tkaziladi")).toBeVisible({ timeout: 60_000 });

      const confirm = await fillMarketTransfer(page, "200000");
      await expect(confirm).toContainText("Filial kassasi");
      await expect(confirm).toContainText("Urgut filiali");
      await expect(confirm).toContainText("Market kassasi");
      await expect(confirm).not.toContainText("Humo Agrobank");
      await expect(confirm).not.toContainText("O'tkazma");
      await expect(confirm).not.toContainText("Asosiy kassa");
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `manager-market-pay-1440-${theme}`);
      await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

      await expect.poll(() => payments.length).toBe(1);
      expect(payments[0].path).toBe("finance/cashbox/payment/market");
      expect(payments[0].body).toEqual(expect.objectContaining({ market_id: "2", amount: 200_000, payment_method: "cash" }));
      expect(payments[0].body).not.toHaveProperty("card_id");
      expect(leaked).toEqual([]);
    });
  }

  test("⭐ kuryerdan qabul (P0 63HO6cBU): «To'lov turi» yo'q — faqat summa; so'rov { courier_id, amount, payment_date, comment }", async ({ page }) => {
    const { payments, leaked } = await mockManagerMarketPayments(page);
    await page.goto("/payments/cash-detail/209?type=courier");
    await expect(page.getByRole("heading", { name: "Kuryerdan qabul qilish" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("group", { name: /To'lov turi/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Naqd", exact: true })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "O'tkazma", exact: true })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Marketga o'tkazma", exact: true })).toHaveCount(0);

    await page.getByRole("textbox", { name: /^Summa/ }).fill("300000");
    await page.getByRole("button", { name: /qabul qilish$/ }).click();
    const confirm = page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" });
    await expect(confirm).toContainText("Kuryer kassasi");
    await expect(confirm).toContainText("Bekzod Normurodov");
    await expect(confirm).toContainText("Filial kassasi");
    await expect(confirm).not.toContainText("Naqd");
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect.poll(() => payments.length).toBe(1);
    expect(payments[0].path).toBe("finance/cashbox/payment/courier");
    expect(Object.keys(payments[0].body).sort()).toEqual(["amount", "comment", "courier_id", "payment_date"]);
    expect(payments[0].body).toEqual(expect.objectContaining({ courier_id: "209", amount: 300_000 }));
    expect(leaked).toEqual([]);
  });

  test("filial kassasi: tezkor amallarda «Marketga to'lov» — «Berilishi kerak» oynasi", async ({ page }) => {
    await mockManagerMarketPayments(page);
    await page.goto("/payments/main-cashbox");
    await page.getByRole("button", { name: /^Marketga to'lov/ }).click({ timeout: 60_000 });
    await expect(page.getByRole("dialog", { name: "Berilishi kerak" })).toBeVisible();
  });

  test("⭐ filial kassasi (P0 63HO6cBU): bitta jami, 2 ta amal; naqd/karta, «Kartalar», xarajat va to'ldirish yo'q", async ({ page }) => {
    const { payments, leaked } = await mockManagerMarketPayments(page);
    await page.goto("/payments/main-cashbox");
    await expect(page.getByRole("button", { name: /^Kuryerdan qabul qilish/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: /^Marketga to'lov/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Kassadan xarajat/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Kassani to'ldirish/ })).toHaveCount(0);
    await expect(page.getByText(/4\s250\s000/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Karta \(Click\)/ })).toHaveCount(0);
    await expect(page.getByRole("img", { name: /^Naqd / })).toHaveCount(0);
    expect(payments).toEqual([]);
    expect(leaked).toEqual([]);
  });

  test("hozirgi backend (menejerga 403 «Forbidden resource») — «Bu to'lovga ruxsatingiz yo'q.»", async ({ page }) => {
    const { payments } = await mockManagerMarketPayments(page, { backend: "today" });
    await page.goto("/payments/cash-detail/2?type=market");
    const confirm = await fillMarketTransfer(page, "200000");
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(page.getByText("Bu to'lovga ruxsatingiz yo'q.", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Forbidden resource")).toHaveCount(0);
    expect(payments).toHaveLength(1);
  });
});
