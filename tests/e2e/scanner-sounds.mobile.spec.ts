import { test } from "@playwright/test";
import { runSoftSoundsSaved } from "./support/scannerSounds";

/** JX0EBpa7 — 390px: 12 ta ovoz kartasi sig'adi, gorizontal skroll yo'q, tanlov saqlanadi. */
test.describe("Skaner ovozlari — yumshoq to'plamlar (390)", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ JX0EBpa7: tanlov saqlanadi, skrollsiz — ${theme}`, async ({ page }, testInfo) => {
      await runSoftSoundsSaved(page, testInfo, "390", theme);
    });
  }
});
