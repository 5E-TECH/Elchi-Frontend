import { expect, test } from "@playwright/test";
import { failPaymentsMeta, openPayments, paymentsMeta } from "./support/paymentsMeta";

/** uzWcMR1C (390): KPI meta telefonda — uzun market nomi ham kartadan toshmaydi, xatoda sanoq chiqmaydi. */
test("superadmin: sanoqlar, segbar va uzun nom gorizontal toshishsiz", async ({ page }) => {
  const longName = "Toshkent shahar Chilonzor tumani ulgurji va chakana savdo do'koni";
  const base = paymentsMeta();
  await openPayments(page, {
    meta: {
      ...base,
      payable: {
        ...base.payable,
        top_markets: [
          { market_id: "101", cashbox_id: "55", name: longName, amount: 4_820_000, share: 35.8 },
          ...base.payable.top_markets.slice(1),
        ],
      },
    },
  });

  const receive = page.getByRole("button", { name: /Qabul qilinishi kerak/ });
  const give = page.getByRole("button", { name: /Berilishi kerak/ });
  await expect(receive).toContainText("5 ta filial · 2 ta HQ kuryeri");
  await expect(give).toContainText("6 ta marketga");
  await expect(give.getByRole("img")).toBeVisible();
  await expect(give).toContainText("Yana 3 ta");

  const name = give.getByText(longName, { exact: true });
  await expect(name).toHaveAttribute("title", longName);
  const box = await give.boundingBox();
  const nameBox = await name.boundingBox();
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(box!.x + box!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("superadmin: 403 — kartalar ishlaydi, sanoq yo'q", async ({ page }) => {
  await failPaymentsMeta(page, 403);
  await openPayments(page);

  await expect(page.getByRole("button", { name: /Berilishi kerak/ })).toContainText("13,5");
  await expect(page.getByText(/ta filial|ta HQ kuryeri|ta marketga/)).toHaveCount(0);
});
