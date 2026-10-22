import { describe, expect, it } from "vitest";
import mainSource from "../../../main.tsx?raw";

/**
 * `beforeinstallprompt` sahifa yuklanishi bilan bir marta keladi: `captureInstallPrompt()` `main.tsx` da modul
 * yuklanishi bilan, tarjimalarni (`i18nReady`) va birinchi chizishni KUTMASDAN chaqirilishi shart — aks holda hodisa
 * o'tib ketadi va «O'rnatish» chiqmaydi. e2e soxta hodisasi `load` da keladi — tartib buzilishini sezmasligi mumkin.
 */
describe("main.tsx: o'rnatish hodisasi chizishdan oldin ushlanadi", () => {
  const code = mainSource.replace(/\/\/.*$/gm, "");
  const callAt = code.search(/^captureInstallPrompt\(\);$/m);

  it("yuqori darajada, sinxron chaqiriladi (effekt yoki then ichida emas)", () => {
    expect(callAt).toBeGreaterThan(-1);
  });

  it("createRoot / render va i18nReady kutishidan oldin", () => {
    for (const marker of ["createRoot(", ".then(render", "await "]) {
      const at = code.indexOf(marker);
      if (at !== -1) expect(callAt, marker).toBeLessThan(at);
    }
  });
});
