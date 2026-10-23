import { expect, test } from "@playwright/test";
import { expectNoRawPeriodKeys, openBalanceAnalysis, periodLabels, RU_PERIODS, UZ_PERIODS } from "./support/balanceAnalysis";

/**
 * SUDGlPuj — Balans → Tahlil davr filtri (maket `superadmin-balance-analysis`): sana oralig'i (v2 `DateRange`) va
 * tez tanlov «Bugun · Bu hafta · Bu oy · Barchasi»; rus tilida to'rttasi ham ruscha; «week / month / year» yo'q.
 * 1440px, kunduzgi va tungi.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ uz (${theme}): «Bugun · Bu hafta · Bu oy · Barchasi», sana oralig'i — v2 DateRange`, async ({ page }, testInfo) => {
    const { period, leaked } = await openBalanceAnalysis(page, { theme });
    expect(await periodLabels(page)).toEqual(UZ_PERIODS);
    // Sana oralig'i — v2 DateRange (bitta boshqaruv, «Boshlanish → Tugash»).
    await expect(period.getByRole("button", { name: /Boshlanish|Sana|\d{2}\.\d{2}/ }).first()).toBeVisible();
    await expectNoRawPeriodKeys(page);

    // Tez tanlov ishlaydi: «Bu hafta» tanlanadi.
    await period.getByRole("radio", { name: "Bu hafta" }).click();
    await expect(period.getByRole("radio", { name: "Bu hafta" })).toHaveAttribute("aria-checked", "true");
    await testInfo.attach(`balance-analysis-uz-${theme}-1440`, { body: await page.screenshot(), contentType: "image/png" });
    expect(leaked).toEqual([]);
  });
}

test("⭐ ru: to'rttasi ham ruscha («Сегодня · Эта неделя · Этот месяц · Все»)", async ({ page }) => {
  await openBalanceAnalysis(page, { language: "ru" });
  expect(await periodLabels(page, "ru")).toEqual(RU_PERIODS);
  await expectNoRawPeriodKeys(page);
});
