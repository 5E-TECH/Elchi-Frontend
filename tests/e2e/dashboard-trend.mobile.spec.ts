import { expect, test } from "@playwright/test";
import { noHorizontalScroll, openDashboard } from "./support/dashboardTrend";

/** DwrMygfo / l9NNdsCH / XdKajqLe — 390px, kunduzgi va tungi: 4 KPI + sparkline sig'adi, gorizontal skroll yo'q. */
test.describe.configure({ timeout: 180_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ 390px (${theme}): 4 KPI (Yo'qotilgan daromad) va sparkline, «Barchasi»da moliyaviy tahlil — skrollsiz`, async ({ page }, testInfo) => {
    const { kpis, requests } = await openDashboard(page, { theme });
    await expect(kpis.locator("[data-sparkline]")).toHaveCount(4);
    await expect(kpis.getByText("Yo'qotilgan daromad", { exact: true })).toBeVisible();
    for (const card of await kpis.locator("[data-kpi]").all()) {
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    expect(await noHorizontalScroll(page)).toBe(true);
    await testInfo.attach(`dashboard-kpi-${theme}-390`, { body: await page.screenshot(), contentType: "image/png" });

    await page.getByRole("radio", { name: "Barchasi" }).click();
    const finance = page.locator("section", { has: page.getByRole("heading", { name: "Moliyaviy tahlil" }) });
    await finance.scrollIntoViewIfNeeded();
    await expect(finance.getByText("Sof foyda · barcha davr")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await testInfo.attach(`dashboard-all-${theme}-390`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(requests.leaked).toEqual([]);
  });
}
