import type { Page } from "@playwright/test";

/**
 * Vizual snapshotlar — shrift. Manrope ilovaning o'zidagidek O'ZIMIZDAN keladi (`src/index.css` → @font-face,
 * `src/shared/assets/fonts/Manrope-wght-*.woff2`, build'da `dist-visual/assets/`), tashqi xost yo'q — tarmoq to'sig'i
 * (`mockApi.ts`) Google Fonts'ni ham boshqa xostlar kabi to'xtatadi (qaytib qo'shilsa test yiqiladi).
 * Zaxira va emoji glyph'lari Playwright Docker obrazidan (CI'da hamma joyda bir xil).
 */

/**
 * Surat olishdan oldin: Manrope haqiqatan yuklangan (`document.fonts.load` bo'sh emas). Aks holda test
 * yiqiladi — zaxira shrift bilan olingan snapshot boshqa yugurishda farq qiladi.
 */
export const assertManropeLoaded = async (page: Page) => {
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = await document.fonts.load("600 16px Manrope");
    // Yuklanishi boshlangan, lekin buzilgan bo'lak (`unicode-range` bo'yicha) — zaxira shrift jim chiziladi.
    const failed = [...document.fonts].filter((face) => face.status === "error").length;
    return { loaded: faces.length, check: document.fonts.check("600 16px Manrope"), failed };
  });
  if (result.failed) {
    throw new Error(`Vizual: ${result.failed} ta shrift bo'lagi yuklanmadi (FontFace status "error") — snapshot olinmaydi.`);
  }
  if (!result.loaded || !result.check) {
    throw new Error(
      'Vizual: Manrope yuklanmadi — document.fonts.load("600 16px Manrope") bo\'sh. ' +
        "dist-visual/assets/Manrope-wght-*.woff2 bormi (`src/index.css` @font-face)? Zaxira shrift bilan snapshot olinmaydi.",
    );
  }
};
