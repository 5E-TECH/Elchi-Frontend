import { expect, test } from "@playwright/test";
import { expectContrast } from "./support/contrast";
import { CONTRAST_PAGES, openContrastPage } from "./support/contrastPages";

/**
 * OpzLWcqJ: jonli kontrast auditi — 9 sahifa × kunduzgi/tungi, 390px (kartalar, pastki varaqa, pastki menyu).
 * Talab — maket `tizim-motion` 07: matn ≥ 4,5:1, `text-subtle` ≥ 3:1.
 */
test.describe("Kontrast auditi — 390px", () => {
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
