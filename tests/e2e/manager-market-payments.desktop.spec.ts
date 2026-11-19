import { expect, test, type Page } from "@playwright/test";
import {
  NOT_BRANCH_MARKET,
  PAYABLE_EXCEEDED,
  SHARE_CHECK_FAILED,
  fillMarketTransfer,
  mockManagerMarketPayments,
  noHorizontalScroll,
} from "./support/managerMarketPayments";

/**
 * Menejer — marketga (ega Bahodir 2026-11-11, BeePost kabi), 1440px: «To'lovlar» → «Marketga to'lov» → «Berilishi
 * kerak» → market kassasi — o'z filiali kassasidan. P0 63HO6cBU (ega 2026-11-17): filial kassasi naqd/kartaga
 * bo'linmaydi — menejerda kuryerdan qabul ham, marketga to'lov ham faqat summa (usul va karta yo'q); filial kassasida
 * bitta jami, 2 ta amal, «Kartalar» oynasi yo'q.
 *
 * 63HO6cBU (BE PR-C): «Berilishi kerak» — faqat o'z filiali marketlari (`GET finance/cashbox/manager/markets`,
 * `GET /markets` EMAS), summa — «To'lash mumkin» (`payable`, filial ulushi emas), 0 — tanlanmaydi; market kassasida
 * chegara — `payable`; so'rov `{ market_id, amount, comment, payment_date }` (`payment_method` yo'q); 400 / 403 / 503
 * matnlari ko'rinadi. Superadmin yo'li o'zgarmagan.
 * Maket yo'q — eng yaqini `superadmin-payments-cash-detail-market`, `superadmin-payments-to-give-dialog`.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Menejer — marketga to'lov, 1440px", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ ${theme}: «Marketga to'lov» → «Berilishi kerak» (o'z filiali, «To'lash mumkin») → market; so'rovda payment_method yo'q`, async ({ page }) => {
      const mock = await mockManagerMarketPayments(page, { theme });
      const { payments, leaked } = mock;
      await page.goto("/payments");
      await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
      const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
      const baraka = picker.getByRole("option", { name: /Baraka Shop/ });
      await expect(baraka).toBeVisible();
      // «To'lash mumkin» (payable) — filial ulushi (4 820 000) emas.
      await expect(baraka).toContainText(/1\s250\s000 so'm/);
      await expect(baraka).not.toContainText(/4\s820\s000/);
      await expect(picker).toContainText(/2 ta market, to'lash mumkin: jami 2\s150\s000 so'm/);
      // «To'lash mumkin» 0 — ro'yxatda, lekin tanlanmaydi.
      const oila = picker.getByRole("option", { name: /Oila Market/ });
      await expect(oila).toHaveAttribute("aria-disabled", "true");
      // Playwright `aria-disabled` elementni bosmaydi — foydalanuvchi bosishi `force` bilan.
      await oila.click({ force: true });
      await expect(oila).toHaveAttribute("aria-selected", "false");
      await expect(picker.getByRole("button", { name: "Tanlash" })).toBeDisabled();
      expect(mock.marketsListCalls()).toBe(0);
      expect(mock.managerMarketsQueries.length).toBeGreaterThan(0);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `manager-market-picker-1440-${theme}`);

      await baraka.dblclick();
      await expect(page).toHaveURL(/\/payments\/cash-detail\/2\?type=market$/);
      await expect(page.getByText("Pul filial kassasidan marketga o'tkaziladi")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("To'lash mumkin", { exact: true })).toBeVisible();
      await expect(page.getByText(/^To'lash mumkin: 1\s250\s000 so'm$/)).toBeVisible();
      await expect(page.getByText("Kassadagi summa")).toHaveCount(0);
      await expect(page.getByText("Operatsiyalar tarixi")).toHaveCount(0);

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
      expect(Object.keys(payments[0].body).sort()).toEqual(["amount", "comment", "market_id", "payment_date"]);
      expect(payments[0].body).toEqual(expect.objectContaining({ market_id: "2", amount: 200_000 }));
      expect(payments[0].idempotencyKey).toEqual(expect.any(String));
      expect(mock.marketsListCalls()).toBe(0);
      expect(leaked).toEqual([]);
    });
  }

  test("⭐ «Berilishi kerak» 503 — bo'sh ro'yxat emas: «Filial ulushini tekshirib bo'lmadi …» → «Qayta urinish» → ro'yxat", async ({ page }) => {
    const mock = await mockManagerMarketPayments(page, { list: "503" });
    await page.goto("/payments");
    await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
    const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
    await expect(picker.getByText(SHARE_CHECK_FAILED)).toBeVisible({ timeout: 30_000 });
    await expect(picker.getByText("Ro'yxatni yuklab bo'lmadi")).toBeVisible();
    await expect(picker.getByText("Bu filialga buyurtma topshiradigan market yo'q")).toHaveCount(0);
    await expect(picker.getByRole("option")).toHaveCount(0);
    await picker.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(picker.getByRole("option", { name: /Baraka Shop/ })).toBeVisible({ timeout: 30_000 });
    expect(mock.marketsListCalls()).toBe(0);
  });

  test("«Berilishi kerak» bo'sh — «Bu filialga buyurtma topshiradigan market yo'q»", async ({ page }) => {
    await mockManagerMarketPayments(page, { list: "empty" });
    await page.goto("/payments");
    await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
    const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
    await expect(picker.getByText("Bu filialga buyurtma topshiradigan market yo'q")).toBeVisible();
    await expect(picker.getByText("Qarzdorlik yo'q")).toHaveCount(0);
  });

  test("⭐ summa «To'lash mumkin» dan oshsa — maydon xatosi, tasdiq va so'rov yo'q", async ({ page }) => {
    const { payments } = await mockManagerMarketPayments(page);
    await page.goto("/payments/cash-detail/2?type=market");
    await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("textbox", { name: /^Summa/ }).fill("1300000");
    await page.getByRole("button", { name: "To'lash" }).click();
    await expect(page.getByText(PAYABLE_EXCEEDED)).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(payments).toEqual([]);
  });

  test("⭐ to'lov 400 — backend matni summa maydoni ostida", async ({ page }) => {
    const { payments } = await mockManagerMarketPayments(page, { pay: "400" });
    await page.goto("/payments/cash-detail/2?type=market");
    const confirm = await fillMarketTransfer(page, "1000000");
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page.getByText(PAYABLE_EXCEEDED)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Summa/ })).toHaveAttribute("aria-invalid", "true");
    expect(payments).toHaveLength(1);
  });

  test("⭐ to'lov 503 — «Filial ulushini tekshirib bo'lmadi …» xabarda, «natija noma'lum» yo'q", async ({ page }) => {
    const { payments } = await mockManagerMarketPayments(page, { pay: "503" });
    await page.goto("/payments/cash-detail/2?type=market");
    const confirm = await fillMarketTransfer(page, "200000");
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page.getByText(SHARE_CHECK_FAILED).first()).toBeVisible();
    await expect(page.getByText(/to'lov o'tgan bo'lishi mumkin/)).toHaveCount(0);
    expect(payments).toHaveLength(1);
  });

  test("to'lov 403 — backendning o'zbekcha sababi («… to'lov HQ orqali»)", async ({ page }) => {
    const { payments } = await mockManagerMarketPayments(page, { pay: "403" });
    await page.goto("/payments/cash-detail/2?type=market");
    const confirm = await fillMarketTransfer(page, "200000");
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(page.getByText(NOT_BRANCH_MARKET, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Forbidden resource")).toHaveCount(0);
    expect(payments).toHaveLength(1);
  });

  test("⭐ market kassasi 403 (filialga aloqasi yo'q) — ruxsat holati, forma yo'q, sahifa bo'sh emas", async ({ page }) => {
    await mockManagerMarketPayments(page, { view: "403" });
    await page.goto("/payments/cash-detail/2?type=market");
    await expect(page.getByText("Bu ma'lumotni ko'rishga ruxsatingiz yo'q")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(NOT_BRANCH_MARKET)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toHaveCount(0);
  });

  test("market kassasi 503 — «Filial ulushini tekshirib bo'lmadi …» + «Qayta urinish»", async ({ page }) => {
    await mockManagerMarketPayments(page, { view: "503" });
    await page.goto("/payments/cash-detail/2?type=market");
    await expect(page.getByText(SHARE_CHECK_FAILED)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Marketga to'lov" })).toHaveCount(0);
  });

  test("superadmin — o'zgarmagan: «Berilishi kerak» GET /markets, to'lovda payment_method", async ({ page }) => {
    const mock = await mockManagerMarketPayments(page, { role: "superadmin" });
    await page.goto("/payments");
    await page.getByRole("button", { name: "Marketga to'lov" }).click({ timeout: 60_000 });
    const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
    await expect(picker.getByRole("option", { name: /Baraka Shop/ })).toContainText(/4\s820\s000 so'm/);
    expect(mock.marketsListCalls()).toBeGreaterThan(0);
    expect(mock.managerMarketsQueries).toEqual([]);
    await picker.getByRole("option", { name: /Baraka Shop/ }).dblclick();
    await expect(page).toHaveURL(/\/payments\/cash-detail\/2\?type=market$/);
    await expect(page.getByText("Pul asosiy kassadan marketga o'tkaziladi")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("textbox", { name: /^Summa/ }).fill("200000");
    await page.getByRole("radio", { name: "Naqd", exact: true }).check();
    await page.getByRole("button", { name: "To'lash" }).click();
    await page.getByRole("alertdialog", { name: "To'lovni tasdiqlang" }).getByRole("button", { name: "Tasdiqlash" }).click();

    await expect.poll(() => mock.payments.length).toBe(1);
    expect(mock.payments[0].body).toEqual(
      expect.objectContaining({ market_id: "2", amount: 200_000, payment_method: "cash" }),
    );
    expect(mock.leaked).toEqual([]);
  });

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
    const mock = await mockManagerMarketPayments(page);
    await page.goto("/payments/main-cashbox");
    await page.getByRole("button", { name: /^Marketga to'lov/ }).click({ timeout: 60_000 });
    const picker = page.getByRole("dialog", { name: "Berilishi kerak" });
    await expect(picker.getByRole("option", { name: /Baraka Shop/ })).toContainText(/1\s250\s000 so'm/);
    expect(mock.marketsListCalls()).toBe(0);
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
});
