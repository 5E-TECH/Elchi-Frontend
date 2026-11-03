import { expect, type Page, type TestInfo } from "@playwright/test";
import { mockStatusCountsApi } from "./ordersStatusCounts";

/**
 * 2KisY7DL — menejer ro'yxatidagi sotish oynasi, tasdiqsiz market (`market.extra_cost_requires_approval: false`):
 * «Kiritilsa, market tasdig'idan o'tadi» eslatmasi yo'q; backend kuryer chegarasi bilan 400 qaytarsa — sabab oyna
 * ichida (toast emas), oyna ochiq qoladi. Tasdiqli marketda eslatma avvalgidek.
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const REASON = "Qo'shimcha xarajat maksimal 30 000 so'm bo'lishi mumkin";
const HINT = "Kiritilsa, market tasdig'idan o'tadi";

const openSell = async (
  page: Page,
  requiresApproval: boolean | undefined,
  theme: "light" | "dark",
) => {
  const { state, leaked } = await mockStatusCountsApi(page, "manager", { theme });
  state.orders[0] = {
    ...state.orders[0],
    market: { id: "37", name: "TEST market", extra_cost_requires_approval: requiresApproval },
  } as (typeof state.orders)[number];
  const sells: string[] = [];
  await page.route(/\/orders\/sell\/133$/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    sells.push(route.request().postData() ?? "");
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ statusCode: 400, message: REASON }),
    });
  });
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({
    timeout: 60_000,
  });
  await page
    .getByRole("button", { name: /133 ni sotish$/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Buyurtmani sotish" });
  await expect(dialog).toBeVisible();
  return { dialog, sells, leaked };
};

export const runNoApprovalSell = async (
  page: Page,
  testInfo: TestInfo,
  label: string,
  theme: "light" | "dark",
) => {
  const { dialog, sells, leaked } = await openSell(page, false, theme);
  await expect(dialog.getByText(HINT)).toHaveCount(0);

  await dialog.getByRole("textbox", { name: "Qo'shimcha xarajat" }).fill("50000");
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Sotish", exact: true }).click();

  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText(REASON);
  await alert.scrollIntoViewIfNeeded();
  // Sabab bir marta — oynada; ortidagi toastda takrorlanmaydi.
  await expect(page.getByText(REASON)).toHaveCount(1);
  await expect(dialog).toBeVisible();
  expect(sells).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const shot = await page.screenshot();
  await testInfo.attach(`no-approval-sell-400-${label}-${theme}`, {
    body: shot,
    contentType: "image/png",
  });
  if (process.env.E2E_SHOTS_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SHOTS_DIR}/no-approval-sell-400-${label}-${theme}.png`,
    });
  }
  expect(leaked).toEqual([]);
};

export const runApprovalMarketHint = async (page: Page) => {
  const { dialog, leaked } = await openSell(page, true, "light");
  await expect(dialog.getByText(HINT)).toBeVisible();
  expect(leaked).toEqual([]);
};
