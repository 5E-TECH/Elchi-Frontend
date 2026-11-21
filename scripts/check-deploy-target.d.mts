/**
 * `scripts/check-deploy-target.mjs` tiplari — `src/test/stagingBuild.test.ts` uni `tsc -b` ostida import qiladi.
 * Funksiya o'zgarsa, shu faylni ham yangilang.
 */

export type DeployTarget = "production" | "staging";

export declare const DEPLOY_TARGETS: DeployTarget[];

/** Muhit → kabinet hosti (CSP `wss://`). */
export declare const SITE_HOSTS: Record<DeployTarget, string>;

/** `.env.<muhit>` → API ilova bilan bir domen orqali (`VITE_BASE_URL=/api/`) chaqiriladimi. */
export declare const envSameOrigin: (root: string, target: DeployTarget) => boolean;

/** `.env.<muhit>` → API hosti: `VITE_BASE_URL`, bir domenli rejimda — `VITE_PUBLIC_API_URL`. */
export declare const envApiHost: (root: string, target: DeployTarget) => string;

/** `wrangler.jsonc` dagi muhit sozlamasi (production — yuqori daraja, staging — `env.staging`). */
export interface WranglerWorker {
  main?: string;
  assets?: { binding?: string; run_worker_first?: boolean | string[] } & Record<string, unknown>;
  vars?: Record<string, string>;
}
export declare const wranglerTarget: (root: string, target: DeployTarget) => WranglerWorker;

/** Bir domenli API'ning Worker sharti (`main`, `assets.binding`, `run_worker_first`, `vars.API_ORIGIN`) — xatolar. */
export declare const checkSameOriginWorker: (worker: WranglerWorker, apiHost: string) => string[];

/** `dir` dagi build `target` muhitiga mosmi — xatolar ro'yxati (bo'sh — mos). */
export declare const checkDeployTarget: (options: { target: string; dir: string; root?: string }) => string[];
