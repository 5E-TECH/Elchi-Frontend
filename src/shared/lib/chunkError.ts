/**
 * DEPLOY'DAN KEYINGI CHUNK XATOSI (G6F68ti6, 6-band).
 *
 * Yangi versiya chiqqach ochiq qolgan tab eski hash'li bo'lim faylini so'raydi — u serverda yo'q (yoki internet yo'q):
 * `import()` rad etiladi («Failed to fetch dynamically imported module …», Safari «Importing a module script
 * failed», Firefox «error loading dynamically imported module»), Vite esa `vite:preloadError` chiqaradi. React.lazy
 * rad etilgan importni keshlaydi — qayta chizish yordam bermaydi, faqat sahifani qayta yuklash.
 *
 *  - onlayn: sahifa BIR MARTA qayta yuklanadi (yangi versiya); 30 s ichida takror bo'lsa — yo'q (cheksiz halqa
 *    bo'lmasin), odatdagi «Ilova xatosi» yo'li;
 *  - oflayn: qayta yuklanmaydi (brauzerning oflayn sahifasi chiqardi) — chegara «Internet aloqasi yo'q» holatini
 *    ko'rsatadi va aloqa qaytgach qayta yuklaydi (`shared/ui/ErrorBoundary.tsx`).
 */

const CHUNK_ERROR_MESSAGE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (?:CSS )?chunk [\w-]+ failed|Unable to preload CSS/i;

export const isChunkLoadError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return name === "ChunkLoadError" || (typeof message === "string" && CHUNK_ERROR_MESSAGE.test(message));
};

const RELOAD_KEY = "elchi:chunk-reload-at";
/** Shu oraliqda ikkinchi qayta yuklash yo'q — yangi versiya ham ochilmasa, odatdagi xato sahifasi. */
export const CHUNK_RELOAD_GUARD_MS = 30_000;

export const isBrowserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Yangi versiya uchun sahifani bir marta qayta yuklaydi. `true` — qayta yuklash boshlandi; `false` — oflayn,
 * yaqinda allaqachon qayta yuklangan yoki `sessionStorage` ishlamaydi (chaqiruvchi odatdagi yo'lni tanlaydi).
 */
export const reloadForNewVersion = (now: number = Date.now()): boolean => {
  if (typeof window === "undefined" || isBrowserOffline()) return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (last && now - last < CHUNK_RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};
