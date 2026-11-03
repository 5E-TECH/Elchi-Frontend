import { test } from "@playwright/test";
import { runLegacyDefaultAndVoice, runSoftSoundsSaved, runUnknownSoundFallback } from "./support/scannerSounds";

/** JX0EBpa7 — Sozlamalar → Skaner: yumshoq ovozlar tanlanadi va saqlanadi (1440). */
test.describe("Skaner ovozlari — yumshoq to'plamlar (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ JX0EBpa7: 13 ta ovoz (BeePost sukut), tanlov hisobga va qurilmaga saqlanadi — ${theme}`, async ({
      page,
    }, testInfo) => {
      await runSoftSoundsSaved(page, testInfo, "1440", theme);
    });
  }

  test("JX0EBpa7: serverdagi noma'lum ovoz ID — «BeePost» (sukut), eski ID ishlaydi", async ({
    page,
  }) => {
    await runUnknownSoundFallback(page);
  });

  test("BeePost: belgisiz eski sukut «Klassik» — «BeePost»; «Ovozli xabar» kaliti saqlanadi", async ({ page }) => {
    await runLegacyDefaultAndVoice(page);
  });
});
