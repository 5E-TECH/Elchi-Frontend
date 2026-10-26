import { test } from "@playwright/test";
import { checkSmsReport } from "./support/smsCampaignReport";

/**
 * H7kpCman — SMS kampaniya hisoboti, 1440px (kunduzgi va tungi). Tekshiruvlar va soxta backend —
 * `support/smsCampaignReport.ts`.
 */
test.describe("SMS kampaniya hisoboti (H7kpCman) — 1440px", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`«Hisobot» → StatCard'lar, SMS bloki, yetkazilmaganlar (${theme})`, async ({ page }) => {
      await checkSmsReport(page, 1440, theme);
    });
  }
});
