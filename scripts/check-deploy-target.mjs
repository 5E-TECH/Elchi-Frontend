#!/usr/bin/env node
/**
 * Deploy oldidan: `dist/` aynan kerakli muhit uchun yig'ilganmi — production ↔ staging adashmasin.
 *
 *   node scripts/check-deploy-target.mjs production [dist]   # main → admin.elchipochta.uz (Worker elchi-frontend)
 *   node scripts/check-deploy-target.mjs staging [dist]      # test → test-admin.elchipochta.uz (elchi-frontend-test)
 *
 * Kutilgan API hosti `.env.<muhit>` dagi `VITE_BASE_URL` dan olinadi, ikkinchi muhitning hosti esa «begona».
 *   - `_headers`: CSP `connect-src` (https + wss) va `report-uri` — o'z hosti; begona host yo'q.
 *   - `index.html`: staging — `noindex` va «[TEST]» sarlavha; production — ikkalasi ham yo'q.
 *   - `assets/*.js`: o'z API manzili bor; production JS'da staging hosti yo'q (staging JS'da production manzili
 *     `shared/const` zaxirasi sifatida qoladi — u faqat `VITE_BASE_URL` bo'sh bo'lganda ishlardi, staging build'i esa
 *     bunga yo'l qo'ymaydi: `scripts/staging-build.mjs` → `stagingApiHost`).
 *   - `manifest.webmanifest` / `robots.txt`: staging — «TEST» nom va `Disallow: /`; production — yo'q.
 *   - Bir domenli API (`VITE_BASE_URL=/api/`): `wrangler.jsonc` dagi o'sha muhit Worker'i `/api/*` va `/socket.io/*`
 *     ni aynan shu API hostiga proksi qiladi (`main`, `assets.binding`, `assets.run_worker_first`, `vars.API_ORIGIN`);
 *     `_headers` connect-src da o'sha muhit kabinetining `wss://` hosti. Worker'siz chiqsa har API so'rovi SPA
 *     `index.html` ni olardi (Elchi-Backend docs/ops/same-origin-api.md).
 * Xato bo'lsa — ro'yxat va exit 1 (CI deploy qadamiga yetmaydi). Test: `src/test/stagingBuild.test.ts`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_SITE_HOST, SAME_ORIGIN_API_PATH, STAGING_SITE_HOST } from "./staging-build.mjs";

/** Muhit → kabinet hosti (CSP `wss://` — socket.io bir domenli API'da kabinet origin'ida). */
export const SITE_HOSTS = { production: PRODUCTION_SITE_HOST, staging: STAGING_SITE_HOST };

export const DEPLOY_TARGETS = ["production", "staging"];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Hostning o'zi (test-api.… ichidagi api.… emas). */
const hostPattern = (host) => new RegExp(`(?<![\\w.-])${escapeRegExp(host)}(?![\\w.-])`);

const envValue = (root, target, key) =>
  new RegExp(`^${key}=(\\S+)$`, "m").exec(readFileSync(resolve(root, `.env.${target}`), "utf8"))?.[1];

/** `.env.<muhit>` → API ilova bilan bir domen orqali (`VITE_BASE_URL=/api/`) chaqiriladimi. */
export const envSameOrigin = (root, target) => envValue(root, target, "VITE_BASE_URL")?.startsWith("/") === true;

/** `.env.<muhit>` → API hosti: `VITE_BASE_URL`, bir domenli rejimda — `VITE_PUBLIC_API_URL`. */
export const envApiHost = (root, target) => {
  const key = envSameOrigin(root, target) ? "VITE_PUBLIC_API_URL" : "VITE_BASE_URL";
  const value = envValue(root, target, key);
  if (!value) throw new Error(`.env.${target}: ${key} topilmadi`);
  return new URL(value).host;
};

/** `wrangler.jsonc` (faqat `//` qatorli izohlar) — o'sha muhit sozlamasi: production — yuqori daraja, staging — `env.staging`. */
export const wranglerTarget = (root, target) => {
  const config = JSON.parse(readFileSync(resolve(root, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  return target === "production" ? config : config.env?.[target] ?? {};
};

/** Bir domenli API'ning Worker sharti: `/api/*` va `/socket.io/*` aynan `https://<apiHost>` ga proksi qilinadi. */
export const checkSameOriginWorker = (worker, apiHost) => {
  const errors = [];
  const firstRoutes = worker.assets?.run_worker_first;
  if (!worker.main) errors.push("wrangler: Worker skripti (main) yo'q");
  if (worker.assets?.binding !== "ASSETS") errors.push("wrangler: assets.binding ASSETS emas");
  for (const route of [`${SAME_ORIGIN_API_PATH}*`, "/socket.io/*"]) {
    if (!Array.isArray(firstRoutes) || !firstRoutes.includes(route)) errors.push(`wrangler: run_worker_first da ${route} yo'q`);
  }
  if (worker.vars?.API_ORIGIN !== `https://${apiHost}`) {
    errors.push(`wrangler: vars.API_ORIGIN https://${apiHost} emas (${worker.vars?.API_ORIGIN ?? "yo'q"})`);
  }
  return errors;
};

/** `dir` dagi build `target` muhitiga mosmi — xatolar ro'yxati (bo'sh — mos). */
export const checkDeployTarget = ({ target, dir, root = process.cwd() }) => {
  if (!DEPLOY_TARGETS.includes(target)) return [`muhit noma'lum: ${target} (${DEPLOY_TARGETS.join(" | ")})`];
  const staging = target === "staging";
  const own = envApiHost(root, target);
  const foreign = envApiHost(root, staging ? "production" : "staging");
  const sameOrigin = envSameOrigin(root, target);
  const errors = [];
  if (sameOrigin) errors.push(...checkSameOriginWorker(wranglerTarget(root, target), own));
  const read = (file) => {
    const path = join(dir, file);
    if (existsSync(path)) return readFileSync(path, "utf8");
    errors.push(`${file} yo'q`);
    return "";
  };

  const headers = read("_headers");
  for (const source of [`https://${own}`, `wss://${own}`, `report-uri https://${own}/csp-report`]) {
    if (!headers.includes(source)) errors.push(`_headers: «${source}» yo'q`);
  }
  const site = SITE_HOSTS[target];
  if (sameOrigin && !hostPattern(`wss://${site}`).test(headers)) errors.push(`_headers: «wss://${site}» yo'q`);
  if (hostPattern(foreign).test(headers)) errors.push(`_headers: begona API hosti ${foreign}`);
  if (/^\s*X-Robots-Tag: noindex/m.test(headers) !== staging) {
    errors.push(`_headers: X-Robots-Tag noindex ${staging ? "yo'q" : "bor"}`);
  }

  const html = read("index.html");
  if (/<meta name="robots" content="noindex/.test(html) !== staging) {
    errors.push(`index.html: robots noindex ${staging ? "yo'q" : "bor"}`);
  }
  if (/<title>\[TEST\] /.test(html) !== staging) errors.push(`index.html: «[TEST]» sarlavha ${staging ? "yo'q" : "bor"}`);

  const assetsDir = join(dir, "assets");
  const scripts = existsSync(assetsDir)
    ? readdirSync(assetsDir)
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFileSync(join(assetsDir, name), "utf8"))
    : [];
  if (scripts.length === 0) errors.push("assets/*.js yo'q");
  else if (!scripts.some((code) => code.includes(`https://${own}`))) errors.push(`assets: API manzili https://${own} yo'q`);
  if (!staging && scripts.some((code) => hostPattern(foreign).test(code))) {
    errors.push(`assets: production JS'da staging hosti ${foreign}`);
  }

  const manifest = read("manifest.webmanifest");
  if (/"name": "[^"]* TEST"/.test(manifest) !== staging) errors.push(`manifest: «TEST» nom ${staging ? "yo'q" : "bor"}`);
  if (/^Disallow: \/$/m.test(read("robots.txt")) !== staging) {
    errors.push(`robots.txt: «Disallow: /» ${staging ? "yo'q" : "bor"}`);
  }
  return errors;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [target, dir = "dist"] = process.argv.slice(2);
  const errors = checkDeployTarget({ target, dir: resolve(dir) });
  if (errors.length > 0) {
    console.error(`✗ ${dir} «${target}» muhitiga mos emas:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`✓ ${dir} — «${target}» build'i (API ${envApiHost(process.cwd(), target)})`);
}
