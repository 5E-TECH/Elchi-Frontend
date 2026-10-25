import { expect, test } from "@playwright/test";
import {
  OPERATOR_MARKET_ID,
  expectNoForbiddenRequests,
  expectNoHorizontalOverflow,
  openOperatorCreate,
  openOperatorOrders,
} from "./support/marketOperatorOrders";

/**
 * MO-3 — market operatori (desktop 1440): «Buyurtmalar» (maket yo'q — eng yaqini `market-orders-list` /
 * `market-orders-detail`), tafsilot faqat o'qish, «Buyurtma yaratish» — faqat «AI bilan»
 * (`market_operator-new-orders-create-manual`, AI qismi). Operatorga yopiq backend yo'llari umuman so'ralmaydi.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ ro'yxat: market jadvali, market/kuryer/viloyat filtrlari yo'q, so'rovda market_id yo'q; tafsilot — faqat o'qish", async ({
  page,
}) => {
  const mock = await openOperatorOrders(page, {}, `/orders?orderMarketId=99`);

  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link", { name: "Buyurtmalar" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Market" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excelga yuklash" })).toHaveAttribute(
    "title",
    "Filtrga mos barcha sahifalar Excel faylga yuklanadi",
  );
  await expect(page.locator("#main-content").getByRole("link", { name: "Buyurtma yaratish" })).toHaveAttribute(
    "href",
    "/new-orders/create",
  );
  await expect.poll(() => mock.listQueries.length).toBeGreaterThan(0);
  expect(mock.listQueries.every((query) => !query.has("market_id"))).toBe(true);

  await page.getByRole("button", { name: /^Filtrlar/ }).click();
  const panel = page.getByRole("group", { name: "Qo'shimcha filtrlar" });
  await expect(panel.getByRole("combobox")).toHaveCount(2);
  await expect(panel.getByRole("combobox", { name: "Yetkazish turi" })).toBeVisible();
  await expect(panel.getByRole("combobox", { name: "Holat" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "№10239" }).click();
  await expect(page).toHaveURL(/\/orders\/edit\/10239$/);
  await expect(page.getByText("Mansur Karimov").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /tahrirlash/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Buyurtma tarixi" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expectNoForbiddenRequests(mock);
});

test("⭐ «Buyurtma yaratish» menyudan: /new-orders → /new-orders/create, «Qo'lda · AI bilan»; AI bilan ikki buyurtma", async ({
  page,
}) => {
  const mock = await openOperatorOrders(page);
  await page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link", { name: "Buyurtma yaratish" }).click();
  await expect(page).toHaveURL(/\/new-orders\/create$/);
  await expect(page.getByRole("heading", { level: 1, name: "Yangi buyurtma" })).toBeVisible();
  await expect(page.getByText("Baraka Shop nomidan")).toBeVisible();
  await expect(page.getByRole("link", { name: /Buyurtmalar/ }).first()).toHaveAttribute("href", "/orders");

  // MO-7: sukut — «Qo'lda»; «AI bilan» tabga o'tiladi.
  const tabs = page.getByTestId("create-mode-tabs");
  await expect(tabs.getByRole("radio", { name: /Qo'lda/ })).toBeChecked();
  await tabs.getByRole("radio", { name: /AI bilan/ }).click();

  await page.getByRole("textbox", { name: "Buyurtma matni" }).fill("Sevara 90 214 55 08 Yunusobod 185 000\nMansur 93 627 18 40");
  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  const cards = page.getByTestId("ai-preview-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute("data-ready", "true");
  await expect(cards.nth(1)).toHaveAttribute("data-ready", "false");
  await cards.nth(1).getByRole("combobox", { name: "Tuman" }).click();
  await page.getByRole("option", { name: /Yunusobod/ }).click();
  await expect(cards.nth(1)).toHaveAttribute("data-ready", "true");

  await page.getByTestId("ai-confirm-bar").getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }).click();
  await expect.poll(() => mock.confirmBodies.length).toBe(1);
  const body = mock.confirmBodies[0] as { market_id?: string; orders: Array<{ district_id: string }> };
  expect(body).not.toHaveProperty("market_id");
  expect(body.orders.map((item) => item.district_id)).toEqual(["101", "102"]);
  await expect(page.getByText("2 ta yaratildi · 0 ta xato").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expectNoForbiddenRequests(mock);
});

test("⭐ MO-7: qo'lda yaratish — viloyat/tuman, katalog; POST /orders market_id va operator'siz, Idempotency-Key; «Operator: Siz»", async ({
  page,
}) => {
  const mock = await openOperatorCreate(page);
  await expect(page.getByTestId("manual-mode-panel")).toBeVisible();
  const aside = page.getByRole("complementary", { name: "Buyurtma xulosasi" });
  await expect(aside.getByRole("textbox", { name: "Operator" })).toHaveValue("Dilnoza Karimova");
  await expect(aside.getByText("Siz — avtomatik yoziladi")).toBeVisible();

  await page.getByRole("combobox", { name: /^Telefon/ }).fill("901234567");
  await page.getByLabel(/^Mijoz ismi/).fill("Aliyev Vali");
  await page.locator("#customer\\.region_id").click();
  await page.getByRole("option", { name: /Toshkent shahri/ }).click();
  await page.locator("#customer\\.district_id").click();
  await page.getByRole("option", { name: /Chilonzor/ }).click();
  await page.getByRole("button", { name: /Telefon ushlagich/ }).click();
  await page.getByLabel(/^Umumiy summa/).fill("150000");
  await aside.getByRole("button", { name: "Buyurtma yaratish" }).click();

  await expect.poll(() => mock.orderBodies.length).toBe(1);
  expect(mock.orderBodies[0]).not.toHaveProperty("market_id");
  expect(mock.orderBodies[0]).not.toHaveProperty("operator");
  expect(mock.orderBodies[0]).toMatchObject({ district_id: "101", total_price: 150000 });
  expect(mock.orderKeys[0]).toEqual(expect.any(String));
  expectNoForbiddenRequests(mock);
});

test("qobiqning boshqa yo'llari — 403; AI o'chiq bo'lsa tablarsiz qo'lda forma (MO-7)", async ({ page }) => {
  const mock = await openOperatorCreate(page, { aiEnabled: false });
  await expect(page.getByLabel(/^Mijoz ismi/)).toBeVisible();
  await expect(page.getByTestId("create-mode-tabs")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Buyurtma matni" })).toHaveCount(0);
  await expect(page.getByText("AI bilan yaratish hozir o'chiq")).toHaveCount(0);

  for (const path of [`/new-orders/${OPERATOR_MARKET_ID}`, `/new-orders/cancelled/${OPERATOR_MARKET_ID}`, "/new-orders/incoming"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 30_000 });
  }
  expectNoForbiddenRequests(mock);
});
