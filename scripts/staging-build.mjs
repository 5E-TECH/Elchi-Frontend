/**
 * TEST muhit (staging) build'i — `npm run build:staging` (`vite build --mode staging`, `.env.staging`).
 *
 * Production build'ga TEGMAYDI: `vite.config.ts` bu funksiyalarni faqat `VITE_APP_ENV=staging` bo'lganda chaqiradi,
 * production `dist/` avvalgidek (bayt-bayt) chiqadi. Staging'da esa build oxirida:
 *   - `_headers` — CSP'dagi API hosti (connect-src https + wss, img-src, media-src, report-uri) test API'ga
 *     almashtiriladi va `X-Robots-Tag: noindex, nofollow` qo'shiladi;
 *   - `index.html` — robots/googlebot `noindex, nofollow`, sarlavha «[TEST] …», PWA nomlari «… TEST»;
 *   - `manifest.webmanifest` — ilova nomi «… TEST» (telefonga o'rnatilgan ikki ilova adashmasin);
 *   - `sw.js` — tizim bildirishnomasi sarlavhasi «[TEST] …», SW versiyasi «…-staging»;
 *   - `robots.txt` — butun sayt `Disallow: /`.
 * Har almashtirish aniq bir joyni topishi shart — topilmasa build yiqiladi (shablon o'zgarsa, staging jimgina
 * production qiymatlari bilan chiqib ketmasin). Tekshiruv: `src/test/stagingBuild.test.ts`.
 */

/** Production API hosti — `public/_headers` shabloni va `.env.production` dagi qiymat (test solishtiradi). */
export const PRODUCTION_API_HOST = "api.elchipochta.uz";

/** Staging'dagi hujjat sarlavhasi prefiksi (`index.html` va `src/widgets/staging-banner` — sahifa nomlari ham). */
export const STAGING_TITLE_PREFIX = "[TEST] ";

/** Staging'da qidiruv tizimlari hech narsani indekslamaydi. */
export const STAGING_ROBOTS_TXT = `# Elchi Pochta — TEST muhit (staging): qidiruv tizimlari indekslamasin.
User-agent: *
Disallow: /
`;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `pattern` manbada aynan `count` marta uchrashi shart; aks holda — build xatosi. */
const replaceExact = (source, pattern, replacement, label, count = 1) => {
  const global = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
  const found = source.match(global)?.length ?? 0;
  if (found !== count) throw new Error(`staging: ${label} — ${count} ta kutilgan, ${found} ta topildi`);
  return source.replace(global, replacement);
};

/**
 * `VITE_BASE_URL` dan staging API hosti. Faqat `https://`, production hostidan farqli — aks holda TEST sayt
 * production API'ga yozib yuborishi (yoki brauzer aralash kontentni bloklashi) mumkin edi.
 */
export const stagingApiHost = (baseUrl) => {
  let url;
  try {
    url = new URL(String(baseUrl ?? "").trim());
  } catch {
    throw new Error(`staging: VITE_BASE_URL noto'g'ri (${baseUrl || "bo'sh"})`);
  }
  if (url.protocol !== "https:") throw new Error(`staging: VITE_BASE_URL https bo'lishi shart (${url.href})`);
  if (url.host === PRODUCTION_API_HOST) {
    throw new Error(`staging: VITE_BASE_URL production API (${PRODUCTION_API_HOST}) — staging faqat test API bilan`);
  }
  return url.host;
};

/** `_headers` (xeshlar to'ldirilgan): production API hosti → staging hosti, `/*` ga `X-Robots-Tag`. */
export const stagingHeaders = (headers, apiHost) => {
  const host = new RegExp(`(https|wss)://${escapeRegExp(PRODUCTION_API_HOST)}(?![\\w.-])`, "g");
  if (!host.test(headers)) throw new Error(`staging: _headers da ${PRODUCTION_API_HOST} topilmadi`);
  const retargeted = headers.replace(host, (_, scheme) => `${scheme}://${apiHost}`);
  return replaceExact(retargeted, /^\/\*\n/m, "/*\n  X-Robots-Tag: noindex, nofollow\n", "_headers «/*» qoidasi");
};

/** `dist/index.html`: noindex, «[TEST]» sarlavha, PWA nomlari. */
export const stagingIndexHtml = (html) => {
  let next = replaceExact(
    html,
    /<meta name="(robots|googlebot)" content="index, follow" \/>/,
    '<meta name="$1" content="noindex, nofollow" />',
    "robots/googlebot meta",
    2,
  );
  next = replaceExact(next, /<title>/, `<title>${STAGING_TITLE_PREFIX}`, "<title>");
  next = replaceExact(
    next,
    /<meta name="apple-mobile-web-app-title" content="([^"]+)" \/>/,
    '<meta name="apple-mobile-web-app-title" content="$1 TEST" />',
    "apple-mobile-web-app-title",
  );
  return replaceExact(
    next,
    /<meta name="application-name" content="([^"]+)" \/>/,
    '<meta name="application-name" content="$1 TEST" />',
    "application-name",
  );
};

/** `manifest.webmanifest`: o'rnatilgan TEST ilova nomi production'nikidan farq qiladi. */
export const stagingManifest = (source) => {
  const manifest = JSON.parse(source);
  if (!manifest.name || !manifest.short_name) throw new Error("staging: manifest name/short_name topilmadi");
  return `${JSON.stringify({ ...manifest, name: `${manifest.name} TEST`, short_name: `${manifest.short_name} TEST` }, null, 2)}\n`;
};

/** `sw.js`: bildirishnoma sarlavhasi «[TEST] …» va alohida SW versiyasi. */
export const stagingServiceWorker = (source) => {
  const next = replaceExact(source, /const SW_VERSION = "([^"]+)";/, 'const SW_VERSION = "$1-staging";', "SW_VERSION");
  return replaceExact(
    next,
    /self\.registration\.showNotification\(payload\.title,/,
    `self.registration.showNotification(${JSON.stringify(STAGING_TITLE_PREFIX)} + payload.title,`,
    "showNotification(payload.title",
  );
};
