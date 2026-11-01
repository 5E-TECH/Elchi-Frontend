import { expect, test } from "@playwright/test";
import { noHorizontalScroll, openAiCost } from "./support/balanceAiCost";

/**
 * Celz3rKJ — «Balans» sahifasida «AI xarajat» bo'limi (tab) ochiladi, 1440px, soxta backend: summary so'm + USD,
 * funksiya kesimi (order_extract_multi, order_district …), Toshkent kunlari bo'yicha trend, buyurtma manbasi
 * (AI / qo'lda / bot), AI buyurtmalar ro'yxati; order-service tushsa — manba joyida xato (0 emas).
 */
test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 1440, height: 900 } });

test("⭐ «AI xarajat» tabi: /ai-usage/* so'rovlari, KPI, kesimlar, manba, AI buyurtmalar", async ({ page }) => {
  const { tab, requests } = await openAiCost(page);
  expect(requests.dashboard).toHaveLength(0);
  await tab.click();
  await expect(page).toHaveURL(/tab=ai/);

  const kpis = page.getByRole("region", { name: "AI xarajati ko'rsatkichlari" });
  await expect(kpis.locator('[data-kpi="cost"]')).toContainText("156,9 ming so'm");
  await expect(kpis.locator('[data-kpi="cost"]')).toContainText("12,40 $");
  await expect(kpis.locator('[data-kpi="orders"]')).toContainText("96");
  const last = requests.dashboard.at(-1)!;
  expect(last.get("fromDate")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(last.get("toDate")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(requests.orders.at(-1)?.get("limit")).toBe("100");

  const features = page.locator("section", { has: page.getByRole("heading", { name: "Funksiyalar bo'yicha" }) });
  await expect(features.getByText("Matndan buyurtma ajratish")).toBeVisible();
  await expect(features.getByText("order_district")).toBeVisible();
  const sources = page.locator("section", { has: page.getByRole("heading", { name: "Buyurtma manbasi" }) });
  await expect(sources.getByText("Telegram bot")).toBeVisible();
  await expect(sources.getByRole("img", { name: /AI 9,6%.*Qo'lda 70,4%.*Telegram bot 6%/ })).toBeVisible();

  const orders = page.locator("section", { has: page.getByRole("heading", { name: "AI buyurtmalar" }) });
  await expect(orders.getByRole("link", { name: "№EL-100081" })).toHaveAttribute("href", "/orders/edit/81");

  // Davr: «Bu hafta» — yangi oraliq bilan qayta so'raladi.
  const before = requests.dashboard.length;
  await page.getByRole("radio", { name: "Bu hafta" }).click();
  await expect.poll(() => requests.dashboard.length).toBeGreaterThan(before);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(requests.leaked).toEqual([]);
});

test("order-service javob bermadi (`orderSources: null`) — manba joyida xato, xarajat ko'rinadi", async ({ page }) => {
  const { tab } = await openAiCost(page, { failSources: true });
  await tab.click();
  const sources = page.locator("section", { has: page.getByRole("heading", { name: "Buyurtma manbasi" }) });
  await expect(sources.getByText("Buyurtma manbasini yuklab bo'lmadi")).toBeVisible();
  await expect(sources.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AI xarajati ko'rsatkichlari" })).toContainText("156,9 ming so'm");
});

test("⭐ marja: `/ai-usage/margin` davr bilan, zarar ko'rgan market birinchi va qizil", async ({ page }) => {
  const { tab, requests } = await openAiCost(page);
  await tab.click();

  const table = page.getByRole("table", { name: "Marja — marketlar kesimida" });
  const first = table.getByRole("row").nth(1);
  await expect(first).toContainText("Nur Market");
  const loss = first.getByText(/[-−]9.000 so'm/);
  await expect(loss).toBeVisible();
  const lossColor = await loss.evaluate((node) => getComputedStyle(node).color);
  const profitColor = await table.getByRole("row").nth(2).getByText(/\+6.000 so'm/).evaluate((node) => getComputedStyle(node).color);
  expect(lossColor).not.toBe(profitColor);

  expect(requests.margin.at(-1)?.get("fromDate")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(requests.margin.at(-1)?.get("fromDate")).toBe(requests.dashboard.at(-1)?.get("fromDate"));
  expect(requests.leaked).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  test(`1440px (${theme}): «AI xarajat» tabi — toshishsiz`, async ({ page }, testInfo) => {
    const { tab, requests } = await openAiCost(page, { theme });
    await tab.click();
    await expect(page.getByRole("region", { name: "AI xarajati ko'rsatkichlari" })).toContainText("156,9");
    await expect(page.getByRole("heading", { name: "AI buyurtmalar" })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await testInfo.attach(`balance-ai-${theme}-1440`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(requests.leaked).toEqual([]);
  });
}
