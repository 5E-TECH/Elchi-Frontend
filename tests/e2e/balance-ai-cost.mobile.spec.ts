import { expect, test } from "@playwright/test";
import { noHorizontalScroll, openAiCost } from "./support/balanceAiCost";

/** Celz3rKJ — «390px da AI xarajat tabi gorizontal skrollsiz» (kunduzgi va tungi): jadvallar kartaga aylanadi. */
test.describe.configure({ timeout: 180_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ 390px (${theme}): «AI xarajat» tabi gorizontal skrollsiz, jadvallar — kartalar`, async ({ page }, testInfo) => {
    const { tab, requests } = await openAiCost(page, { theme });
    await tab.click();
    await expect(page.getByRole("region", { name: "AI xarajati ko'rsatkichlari" })).toContainText("156,9 ming so'm");
    const orders = page.locator("section", { has: page.getByRole("heading", { name: "AI buyurtmalar" }) });
    await orders.scrollIntoViewIfNeeded();
    await expect(orders.getByRole("link", { name: /№EL-100081/ })).toBeVisible();
    // «Grafik | Jadval» → jadval telefonda kartalar (gorizontal skroll yo'q).
    await page.getByRole("radio", { name: "Jadval" }).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    for (const radio of await page.getByRole("radiogroup", { name: "Tez tanlov" }).getByRole("radio").all()) {
      const box = (await radio.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    await testInfo.attach(`balance-ai-${theme}-390`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(requests.leaked).toEqual([]);
  });
}
