import { expect, test, type Page } from "@playwright/test";
import { HQ_MANAGER_PROFILE } from "./support/shellSession";
import { failPaymentsMeta, openPayments, paymentsMeta, PAYMENTS_META_PATH } from "./support/paymentsMeta";

/**
 * uzWcMR1C (1440): `/payments` KPI meta — «N ta filial · N ta HQ kuryeri», «N ta marketga», top-market segbar
 * (`GET finance/cashbox/payments-meta`, ro'yxat so'ralmaydi). 403 / xatoda sanoq chiqmaydi, yolg'on 0 yo'q.
 */
const receiveCard = (page: Page) => page.getByRole("button", { name: /Qabul qilinishi kerak/ });
const giveCard = (page: Page) => page.getByRole("button", { name: /Berilishi kerak/ });

for (const role of ["superadmin", "admin"]) {
  test(`${role}: sanoqlar va top-market segbar bitta agregatdan, 10 000 lik ro'yxatsiz`, async ({ page }) => {
    const { leaked, requests } = await openPayments(page, { role });

    await expect(receiveCard(page)).toContainText("5 ta filial · 2 ta HQ kuryeri");
    await expect(giveCard(page)).toContainText("6 ta marketga");
    await expect(
      giveCard(page).getByRole("img", {
        name: "Baraka Shop 36%, Nur Elektronika 23%, Chilonzor Market 17%, yana 3 ta market 24%",
      }),
    ).toBeVisible();
    for (const text of ["Baraka Shop", "4,8 mln", "Nur Elektronika", "3,1 mln", "Chilonzor Market", "2,3 mln", "3,2 mln"]) {
      await expect(giveCard(page).getByText(text, { exact: true })).toBeVisible();
    }
    await expect(giveCard(page)).toContainText("Yana 3 ta");

    const metaRequests = requests.filter((url) => url.includes(PAYMENTS_META_PATH));
    expect(metaRequests).toHaveLength(1);
    expect(new URL(metaRequests[0]).searchParams.get("top")).toBe("3");
    expect(requests.filter((url) => /[?&]limit=\d{4,}/.test(url))).toEqual([]);
    expect(leaked).toEqual([]);
  });
}

for (const status of [403, 500]) {
  test(`superadmin: ${status} — sahifa ishlaydi, sanoq shunchaki chiqmaydi, xato xabari yo'q`, async ({ page }) => {
    await failPaymentsMeta(page, status);
    const { requests } = await openPayments(page);

    await expect(receiveCard(page)).toContainText("9,9");
    await expect(giveCard(page)).toContainText("13,5");
    await expect.poll(() => requests.filter((url) => url.includes(PAYMENTS_META_PATH)).length).toBeGreaterThan(0);
    await expect(page.getByText(/ta filial|ta HQ kuryeri|ta marketga/)).toHaveCount(0);
    await expect(giveCard(page).getByRole("img")).toHaveCount(0);
    await expect(giveCard(page).locator("[data-skeleton]")).toHaveCount(0);
    await expect(page.getByText("Ma'lumotni yuklab bo'lmadi")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "To'lovlar" })).toBeVisible();
  });
}

test("superadmin: manba javob bermagan blok chizilmaydi, haqiqiy 0 qoladi", async ({ page }) => {
  await openPayments(page, {
    meta: paymentsMeta({
      receivable: { amount: 769_000, branches: { count: 2, amount: 769_000 }, hq_couriers: null },
      payable: null,
    }),
  });

  await expect(receiveCard(page)).toContainText("2 ta filial");
  await expect(page.getByText(/ta HQ kuryeri/)).toHaveCount(0);
  await expect(page.getByText(/ta marketga/)).toHaveCount(0);
});

test("menejer: agregat so'ralmaydi (faqat superadmin/admin)", async ({ page }) => {
  const { requests } = await openPayments(page, { role: "manager", profile: HQ_MANAGER_PROFILE });

  await expect(page.getByRole("heading", { level: 1, name: "To'lovlar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Berilishi kerak/ })).toBeVisible();
  expect(requests.filter((url) => url.includes(PAYMENTS_META_PATH))).toEqual([]);
  await expect(page.getByText(/ta marketga/)).toHaveCount(0);
});
