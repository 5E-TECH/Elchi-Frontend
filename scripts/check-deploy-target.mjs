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
 * Xato bo'lsa — ro'yxat va exit 1 (CI deploy qadamiga yetmaydi). Test: `src/test/stagingBuild.test.ts`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPLOY_TARGETS = ["production", "staging"];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Hostning o'zi (test-api.… ichidagi api.… emas). */
const hostPattern = (host) => new RegExp(`(?<![\\w.-])${escapeRegExp(host)}(?![\\w.-])`);

/** `.env.<muhit>` → `VITE_BASE_URL` hosti. */
export const envApiHost = (root, target) => {
  const file = resolve(root, `.env.${target}`);
  const value = /^VITE_BASE_URL=(\S+)$/m.exec(readFileSync(file, "utf8"))?.[1];
  if (!value) throw new Error(`.env.${target}: VITE_BASE_URL topilmadi`);
  return new URL(value).host;
};

/** `dir` dagi build `target` muhitiga mosmi — xatolar ro'yxati (bo'sh — mos). */
export const checkDeployTarget = ({ target, dir, root = process.cwd() }) => {
  if (!DEPLOY_TARGETS.includes(target)) return [`muhit noma'lum: ${target} (${DEPLOY_TARGETS.join(" | ")})`];
  const staging = target === "staging";
  const own = envApiHost(root, target);
  const foreign = envApiHost(root, staging ? "production" : "staging");
  const errors = [];
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
