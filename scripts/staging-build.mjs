/**
 * TEST muhit (staging) build'i — `npm run build:staging` (`vite build --mode staging`, `.env.staging`).
 *
 * Production build'ga TEGMAYDI: `vite.config.ts` bu funksiyalarni faqat `VITE_APP_ENV=staging` bo'lganda chaqiradi,
 * production `dist/` avvalgidek (bayt-bayt) chiqadi. Staging'da esa build oxirida:
 *   - `_headers` — CSP'dagi API hosti (connect-src https + wss, img-src, media-src, report-uri) test API'ga
 *     almashtiriladi va `X-Robots-Tag: noindex, nofollow` qo'shiladi; bir domenli API'da (`VITE_BASE_URL=/api/`)
 *     connect-src ga kabinetning o'z `wss://` hosti ham qo'shiladi (socket.io endi kabinet origin'ida);
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
 * Staging API hosti (`VITE_BASE_URL`, bir domenli rejimda — `VITE_PUBLIC_API_URL`). Faqat `https://`, production
 * hostidan farqli — aks holda TEST sayt production API'ga yozib yuborishi (yoki brauzer aralash kontentni bloklashi)
 * mumkin edi.
 */
export const stagingApiHost = (baseUrl, name = "VITE_BASE_URL") => {
  let url;
  try {
    url = new URL(String(baseUrl ?? "").trim());
  } catch {
    throw new Error(`staging: ${name} noto'g'ri (${baseUrl || "bo'sh"})`);
  }
  if (url.protocol !== "https:") throw new Error(`staging: ${name} https bo'lishi shart (${url.href})`);
  if (url.host === PRODUCTION_API_HOST) {
    throw new Error(`staging: ${name} production API (${PRODUCTION_API_HOST}) — staging faqat test API bilan`);
  }
  return url.host;
};

/**
 * Bir domenli API (same-origin) yo'li: `VITE_BASE_URL=/api/` — kabinet Worker'i (`worker/proxy.ts` → `API_PREFIX`)
 * aynan shu prefiksni API'ga proksi qiladi (`wrangler.jsonc` → `assets.run_worker_first`).
 */
export const SAME_ORIGIN_API_PATH = "/api/";

/** TEST kabinet hosti — `wrangler.jsonc` → `env.staging.routes` (test solishtiradi). */
export const STAGING_SITE_HOST = "test-admin.elchipochta.uz";

/**
 * Staging build maqsadi `.env.staging` dan:
 *   - `VITE_BASE_URL` absolyut (`https://test-api…/`) — ilova API'ga to'g'ridan-to'g'ri (CORS) murojaat qiladi;
 *   - `VITE_BASE_URL=/api/` — bir domenli API (`sameOrigin`); API hosti `VITE_PUBLIC_API_URL` dan.
 * Boshqa nisbiy yo'l — xato: Worker uni proksi qilmaydi, so'rovlar SPA `index.html` ga tushardi.
 */
export const stagingApiTarget = (env) => {
  const base = String(env?.VITE_BASE_URL ?? "").trim();
  if (!base.startsWith("/")) return { apiHost: stagingApiHost(base), sameOrigin: false };
  if (base !== SAME_ORIGIN_API_PATH) {
    throw new Error(`staging: VITE_BASE_URL nisbiy bo'lsa faqat ${SAME_ORIGIN_API_PATH} (Worker proksi yo'li), «${base}» emas`);
  }
  return { apiHost: stagingApiHost(env?.VITE_PUBLIC_API_URL, "VITE_PUBLIC_API_URL"), sameOrigin: true };
};

/**
 * `_headers` (xeshlar to'ldirilgan): production API hosti → staging hosti, `/*` ga `X-Robots-Tag`. Bir domenli API'da
 * connect-src ga `wss://<kabinet hosti>` qo'shiladi: socket.io kabinet origin'iga ulanadi (`'self'` wss'ni hamma
 * brauzerda ham qamramaydi). API hosti img-src / media-src / connect-src da qoladi — backend absolyut fayl URL
 * qaytarsa ham ochiladi.
 */
export const stagingHeaders = (headers, apiHost, { sameOrigin = false } = {}) => {
  const host = new RegExp(`(https|wss)://${escapeRegExp(PRODUCTION_API_HOST)}(?![\\w.-])`, "g");
  if (!host.test(headers)) throw new Error(`staging: _headers da ${PRODUCTION_API_HOST} topilmadi`);
  let retargeted = headers.replace(host, (_, scheme) => `${scheme}://${apiHost}`);
  if (sameOrigin) {
    retargeted = replaceExact(
      retargeted,
      /connect-src 'self' /,
      `connect-src 'self' wss://${STAGING_SITE_HOST} `,
      "_headers connect-src 'self'",
    );
  }
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
