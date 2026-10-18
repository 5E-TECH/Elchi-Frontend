import type { Page, Route } from "@playwright/test";

/**
 * Vizual snapshotlar — shrift. Manrope ilovaning o'zidagidek Google Fonts'dan keladi (`index.html` →
 * `fonts.googleapis.com/css2?family=Manrope…`, fayllar `fonts.gstatic.com`), yangi npm bog'liqlik yo'q.
 * Tarmoq to'sig'i (`mockApi.ts`) faqat shu ikki xostga HTTPS orqali ruxsat beradi.
 * Zaxira va emoji glyph'lari Playwright Docker obrazidan (CI'da hamma joyda bir xil).
 */
export const FONT_HOSTS: ReadonlySet<string> = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

type CachedFont = { status: number; headers: Record<string, string>; body: Buffer };
/** Ishchi jarayon ichida kesh: bir yugurishda CSS va woff2 bir marta olinadi (barcha sahnada bir xil baytlar). */
const fontCache = new Map<string, Promise<CachedFont>>();
/** Brauzerga qaytariladigan sarlavhalar (tana allaqachon ochilgan — `content-encoding` / uzunlik berilmaydi). */
const PASS_HEADERS = ["content-type", "cache-control", "timing-allow-origin"];

const fetchFont = async (route: Route): Promise<CachedFont> => {
  let lastError: unknown;
  // Tarmoq lip etsa (CI'da ham bo'ladi) — 4 urinish, 0,5 / 1 / 2 s kutib.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await route.fetch({ timeout: 20_000 });
      if (response.status() >= 500 || response.status() === 429) throw new Error(`HTTP ${response.status()}`);
      const source = response.headers();
      const headers: Record<string, string> = { "access-control-allow-origin": "*" };
      for (const name of PASS_HEADERS) if (source[name]) headers[name] = source[name];
      return { status: response.status(), headers, body: await response.body() };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
};

/**
 * Google Fonts so'rovi (`mockApi.ts` to'sig'idan): Node tomonda qayta urinish va kesh bilan olinadi.
 * Baribir olinmasa (yoki 4xx) — so'rov to'xtatiladi, `false` qaytadi va `mockApi` uni `fontErrors` ga yozadi →
 * test yiqiladi. Bu muhim: `assertManropeLoaded` faqat lotin 600 yuzini tekshiradi, `cyrillic` / `latin-ext`
 * bo'laklari (masalan «№» — cyrillic) yuklanmasa zaxira shrift jim chiziladi va snapshot boshqacha bo'ladi.
 */
export const serveFont = async (route: Route): Promise<boolean> => {
  const request = route.request();
  const key = `${request.url()}|${request.headers()["user-agent"] ?? ""}`;
  let pending = fontCache.get(key);
  if (!pending) {
    pending = fetchFont(route);
    fontCache.set(key, pending);
    pending.catch(() => fontCache.delete(key));
  }
  let font: CachedFont;
  try {
    font = await pending;
  } catch {
    await route.abort("internetdisconnected").catch(() => {});
    return false;
  }
  // Sahifa yopilgan bo'lsa fulfill xato beradi — bu shrift xatosi emas.
  await route.fulfill(font).catch(() => {});
  return font.status < 400;
};

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
        "fonts.googleapis.com / fonts.gstatic.com ga kirish bormi? Zaxira shrift bilan snapshot olinmaydi.",
    );
  }
};
