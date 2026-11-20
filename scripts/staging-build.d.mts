/**
 * `scripts/staging-build.mjs` tiplari — `vite.config.ts` va `src/test/stagingBuild.test.ts` uni `tsc -b` ostida
 * import qiladi. Funksiya o'zgarsa, shu faylni ham yangilang.
 */

export declare const PRODUCTION_API_HOST: "api.elchipochta.uz";
export declare const STAGING_TITLE_PREFIX: "[TEST] ";
export declare const STAGING_ROBOTS_TXT: string;

/** Bir domenli API yo'li (`VITE_BASE_URL=/api/`) — Worker (`worker/index.ts`) shu prefiksni proksi qiladi. */
export declare const SAME_ORIGIN_API_PATH: "/api/";
/** TEST kabinet hosti (`wrangler.jsonc` → `env.staging.routes`). */
export declare const STAGING_SITE_HOST: "test-admin.elchipochta.uz";

/** URL → staging API hosti (faqat https, production hostidan farqli; aks holda xato). `name` — xato matnidagi kalit. */
export declare const stagingApiHost: (baseUrl: string | undefined, name?: string) => string;
/** `.env.staging` → API hosti va bir domenli rejim (`VITE_BASE_URL=/api/` → `VITE_PUBLIC_API_URL`); aks holda xato. */
export declare const stagingApiTarget: (env: Record<string, string | undefined>) => { apiHost: string; sameOrigin: boolean };
/**
 * `_headers`: production API hosti → staging hosti, `/*` ga `X-Robots-Tag: noindex, nofollow`; `sameOrigin` da
 * connect-src ga `wss://<kabinet hosti>`.
 */
export declare const stagingHeaders: (headers: string, apiHost: string, options?: { sameOrigin?: boolean }) => string;
/** `index.html`: noindex, «[TEST]» sarlavha, PWA nomlari. */
export declare const stagingIndexHtml: (html: string) => string;
/** `manifest.webmanifest`: ilova nomi «… TEST». */
export declare const stagingManifest: (source: string) => string;
/** `sw.js`: bildirishnoma sarlavhasi «[TEST] …», SW versiyasi «…-staging». */
export declare const stagingServiceWorker: (source: string) => string;
