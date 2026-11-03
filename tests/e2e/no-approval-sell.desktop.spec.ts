import { test } from "@playwright/test";
import { runApprovalMarketHint, runNoApprovalSell } from "./support/noApprovalSell";

/** 2KisY7DL — tasdiqsiz marketda menejerga tasdiq eslatmasi yo'q, 400 sababi oyna ichida (1440). */
test.describe("Menejer sotish oynasi — tasdiqsiz market (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ 2KisY7DL: eslatma yo'q, 400 sababi oyna ichida — ${theme}`, async ({
      page,
    }, testInfo) => {
      await runNoApprovalSell(page, testInfo, "1440", theme);
    });
  }

  test("tasdiqli marketda «Kiritilsa, market tasdig'idan o'tadi» avvalgidek", async ({ page }) => {
    await runApprovalMarketHint(page);
  });
});
