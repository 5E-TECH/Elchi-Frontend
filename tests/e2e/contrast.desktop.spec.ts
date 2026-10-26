import { expect, test } from "@playwright/test";
import { expectContrast } from "./support/contrast";
import { CONTRAST_PAGES, openContrastPage } from "./support/contrastPages";

/**
 * OpzLWcqJ (avval xYWDHMTi «447ec1» — faqat tungi /payments va /settings): jonli kontrast auditi — 9 sahifa
 * (oyna va tablar bilan) × kunduzgi/tungi, 1440px. Talab — maket `tizim-motion` 07: matn ≥ 4,5:1, `text-subtle` ≥ 3:1.
 */
test.describe("Kontrast auditi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    for (const target of CONTRAST_PAGES) {
      test(`${theme}: ${target.path} — barcha matn talabda`, async ({ page }) => {
        const { leaked } = await openContrastPage(page, target, theme);
        const check = async (options?: { minElements?: number }) => {
          await expectContrast(page, options);
        };
        await (target.run ? target.run(page, check) : check());
        expect(leaked).toEqual([]);
      });
    }
  }
});
