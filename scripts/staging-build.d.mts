/**
 * `scripts/staging-build.mjs` tiplari — `vite.config.ts` va `src/test/stagingBuild.test.ts` uni `tsc -b` ostida
 * import qiladi. Funksiya o'zgarsa, shu faylni ham yangilang.
 */

export declare const PRODUCTION_API_HOST: "api.elchipochta.uz";
export declare const STAGING_TITLE_PREFIX: "[TEST] ";
export declare const STAGING_ROBOTS_TXT: string;

/** `VITE_BASE_URL` → staging API hosti (faqat https, production hostidan farqli; aks holda xato). */
export declare const stagingApiHost: (baseUrl: string | undefined) => string;
/** `_headers`: production API hosti → staging hosti, `/*` ga `X-Robots-Tag: noindex, nofollow`. */
export declare const stagingHeaders: (headers: string, apiHost: string) => string;
/** `index.html`: noindex, «[TEST]» sarlavha, PWA nomlari. */
export declare const stagingIndexHtml: (html: string) => string;
/** `manifest.webmanifest`: ilova nomi «… TEST». */
export declare const stagingManifest: (source: string) => string;
/** `sw.js`: bildirishnoma sarlavhasi «[TEST] …», SW versiyasi «…-staging». */
export declare const stagingServiceWorker: (source: string) => string;
