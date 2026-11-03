import { test } from "@playwright/test";
import { runNoApprovalSell } from "./support/noApprovalSell";

/** 2KisY7DL — 390px: pastki varaqada 400 sababi ko'rinadi, gorizontal skroll yo'q. */
test.describe("Menejer sotish oynasi — tasdiqsiz market (390)", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ 2KisY7DL: 400 sababi pastki varaqada — ${theme}`, async ({ page }, testInfo) => {
      await runNoApprovalSell(page, testInfo, "390", theme);
    });
  }
});
