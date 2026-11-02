import { expect, test, type Page } from "@playwright/test";
import { historyDaily, openAsManager, openFinancePage } from "./support/financeDaily";

/** qzjTMWPb (390): kunlik grafiklar telefonda — gorizontal toshish yo'q, tanlangan kun qatori ko'rinadi. */
const expectNoOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test("superadmin /payments: «Pul oqimi» va «Kassa holati» toshishsiz", async ({ page }) => {
  await openFinancePage(page);
  const flow = page.getByRole("region", { name: "Pul oqimi" });
  await expect(flow.getByRole("img")).toBeVisible();
  await expect(flow.getByRole("status")).toContainText("tanlangan");
  await expect(page.getByRole("region", { name: "Kassa holati" })).toContainText("21 027 000");
  await expectNoOverflow(page);
});

test("menejer /payments: «Kassa oqimi», delta", async ({ page }) => {
  await openAsManager(page, "/payments");
  await expect(page.getByRole("region", { name: "Kassa oqimi" })).toBeVisible();
  await expect(page.getByText("kechaga nisbatan", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("/financial-balance: KPI chiziqlari toshishsiz", async ({ page }) => {
  await openFinancePage(page, { route: "/financial-balance" });
  await expect(page.locator("[data-sparkline]").first()).toBeVisible();
  await expectNoOverflow(page);
});

test("kuryer /cash-box: grafik o'rnida chiziq, delta", async ({ page }) => {
  await openFinancePage(page, {
    role: "courier",
    route: "/cash-box",
    history: historyDaily(8),
    extra: {
      "finance/cashbox/my-cashbox": { cashbox: { id: "9", balance: 1_245_000, cashbox_type: "couriers" }, cashboxHistory: [] },
    },
  });
  await expect(page.getByText("kechaga nisbatan", { exact: true })).toBeVisible();
  await expect(page.locator("[data-sparkline]")).toBeVisible();
  await expect(page.getByText("Kun oxiridagi qoldiq", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});
