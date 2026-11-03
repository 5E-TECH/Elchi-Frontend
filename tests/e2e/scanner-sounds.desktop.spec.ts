import { test } from "@playwright/test";
import { runSoftSoundsSaved, runUnknownSoundFallback } from "./support/scannerSounds";

/** JX0EBpa7 — Sozlamalar → Skaner: yumshoq ovozlar tanlanadi va saqlanadi (1440). */
test.describe("Skaner ovozlari — yumshoq to'plamlar (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ JX0EBpa7: 12 ta ovoz, tanlov hisobga va qurilmaga saqlanadi — ${theme}`, async ({
      page,
    }, testInfo) => {
      await runSoftSoundsSaved(page, testInfo, "1440", theme);
    });
  }

  test("JX0EBpa7: serverdagi noma'lum ovoz ID — «Klassik» (zaxira), eski ID ishlaydi", async ({
    page,
  }) => {
    await runUnknownSoundFallback(page);
  });
});
