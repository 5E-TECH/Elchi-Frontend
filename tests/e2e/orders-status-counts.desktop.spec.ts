import { expect, test, type Page } from "@playwright/test";
import { mockStatusCountsApi } from "./support/ordersStatusCounts";

/**
 * GaBIPi3Z — `/orders` holat tablari sonlari va «Qabul va yaratish» badge'i, 1440px (kunduzgi / tungi).
 * Maketlar: `superadmin-orders-list` («Barchasi 1 248 · Yangi 32 …»), `tizim-states-navigation` (yon menyu soni 7).
 */

const openOrders = async (page: Page, route = "/orders") => {
  await page.goto(route);
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });
};

const TAB_TEXTS = [
  "Barchasi 1 248",
  "Yangi 32",
  "Qabul qilindi 120",
  "Yo'lda 86",
  "Kutilmoqda 14",
  "Sotilgan 734",
  "To'langan 168",
  "Bekor qilingan 0",
];

/** Matndagi oddiy / ingichka bo'shliqlar bitta oddiy bo'shliqqa (ming ajratuvchi — `formatNumberLocalized`). */
const norm = (text: string) => text.replace(/[\s\u00a0\u202f]+/g, " ").trim();

test.describe("Buyurtmalar — holat tablari sonlari (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ admin (${theme}): har tabda son, yon menyuda «Qabul va yaratish 7»`, async ({ page }, testInfo) => {
      const { state, leaked } = await mockStatusCountsApi(page, "admin", { theme });
      await openOrders(page);

      const tabs = page.getByRole("tablist", { name: "Holat bo'yicha" });
      await expect.poll(async () => (await tabs.getByRole("tab").allInnerTexts()).map(norm)).toEqual(TAB_TEXTS);

      const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
      const intake = nav.getByRole("link", { name: "Qabul va yaratish, 7 ta yangi" });
      await expect(intake).toBeVisible();
      await expect(intake).toContainText("7");

      // Filtrsiz ro'yxat va yon menyu badge'i — bitta kesh yozuvi: so'rov `{}` (holat / sahifa / limitsiz).
      expect(state.countQueries.length).toBeGreaterThan(0);
      expect(state.countQueries.every((query) => Object.keys(query).length === 0)).toBe(true);
      await testInfo.attach(`orders-status-counts-${theme}-1440`, { body: await page.screenshot(), contentType: "image/png" });
      expect(leaked).toEqual([]);
    });
  }

  test("filtr sonlarga ham ketadi; tab almashsa sonlar qayta so'ralmaydi", async ({ page }) => {
    const { state } = await mockStatusCountsApi(page, "admin");
    await openOrders(page, "/orders?orderMarketId=37&startDay=2026-10-01&endDay=2026-10-26&status=new");
    const tabs = page.getByRole("tablist", { name: "Holat bo'yicha" });
    await expect(tabs.getByRole("tab", { name: /^Yangi/ })).toHaveAttribute("aria-selected", "true");
    // Yon menyu badge'i filtrsiz (`{}`) so'raydi; tablar — ro'yxat filtrlari bilan, holatsiz.
    const filtered = { market_id: "37", start_day: "2026-10-01", end_day: "2026-10-26" };
    await expect.poll(() => state.countQueries).toContainEqual(filtered);
    expect(state.countQueries.every((query) => !("status" in query) && !("page" in query) && !("limit" in query))).toBe(true);
    expect(state.listQueries.at(-1)).toMatchObject({ market_id: "37", status: "new" });

    const countsBefore = state.countQueries.filter((query) => query.market_id === "37").length;
    const listBefore = state.listQueries.length;
    await tabs.getByRole("tab", { name: /^Sotilgan/ }).click();
    await expect.poll(() => state.listQueries.length).toBeGreaterThan(listBefore);
    expect(state.countQueries.filter((query) => query.market_id === "37").length).toBe(countsBefore);
  });

  test("market: badge «Qabul va yaratish» bandida (o'z yangi buyurtmalari)", async ({ page }) => {
    const { leaked } = await mockStatusCountsApi(page, "market");
    await openOrders(page);
    await expect(page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link", { name: /, 7 ta yangi$/ })).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("kuryer: sonlar o'z ro'yxati endpointidan (40), status-counts so'ralmaydi", async ({ page }) => {
    const { state } = await mockStatusCountsApi(page, "courier");
    await openOrders(page);
    const tabs = page.getByRole("tablist", { name: "Holat bo'yicha" });
    await expect.poll(async () => (await tabs.getByRole("tab").allInnerTexts()).map(norm)).toEqual([
      "Kutilayotgan 4",
      "Barchasi 40",
      "Bekor qilingan 9",
    ]);
    expect(state.requests.filter((request) => request.endsWith("orders/status-counts"))).toEqual([]);
  });
});
