/**
 * `scripts/check-deploy-target.mjs` tiplari — `src/test/stagingBuild.test.ts` uni `tsc -b` ostida import qiladi.
 * Funksiya o'zgarsa, shu faylni ham yangilang.
 */

export type DeployTarget = "production" | "staging";

export declare const DEPLOY_TARGETS: DeployTarget[];

/** `.env.<muhit>` → `VITE_BASE_URL` hosti. */
export declare const envApiHost: (root: string, target: DeployTarget) => string;

/** `dir` dagi build `target` muhitiga mosmi — xatolar ro'yxati (bo'sh — mos). */
export declare const checkDeployTarget: (options: { target: string; dir: string; root?: string }) => string[];
