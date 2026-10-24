import { createHash } from "node:crypto";

/**
 * CSP — ichki skriptlar xeshi (KwodkKWY).
 *
 * `public/_headers` dagi CSP `script-src` ida ichki `<script>` lar uchun `'unsafe-inline'` YO'Q — har biri o'z
 * `sha256-…` xeshi bilan ruxsat etiladi. `index.html` da ikkita ichki skript bor: mavzu (FOUC, qo'lda yozilgan) va
 * `elchi-first-paint-preload` (har build'da chunk nomlari o'zgaradi). Shuning uchun xeshlar build oxirida
 * `dist/index.html` dan hisoblanadi va `dist/_headers` dagi `{{INLINE_SCRIPT_HASHES}}` o'rniga yoziladi
 * (`vite.config.ts` → `cspInlineScriptHashes`). Xesh hisoblanmasa build yiqiladi — eskirgan xesh prod'ga chiqmasin.
 */

export const INLINE_SCRIPT_HASHES_PLACEHOLDER = "{{INLINE_SCRIPT_HASHES}}";

/** Bajarilmaydigan (ma'lumot) bloklari — CSP ularga taalluqli emas. */
const DATA_BLOCK_TYPE = /\btype\s*=\s*["']?application\/(ld\+)?json/i;

/** `<script>…</script>` (src siz, bajariladigan) matnlarining `'sha256-…'` manbalari, takrorsiz, tartibi bilan. */
export const inlineScriptHashes = (html) => {
  const hashes = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = match;
    if (/\bsrc\s*=/i.test(attrs) || DATA_BLOCK_TYPE.test(attrs)) continue;
    const hash = `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
    if (!hashes.includes(hash)) hashes.push(hash);
  }
  return hashes;
};

/** `_headers` shablonidagi joy tutuvchini xeshlar bilan almashtiradi. Joy tutuvchi yo'q bo'lsa — xato. */
export const fillInlineScriptHashes = (headers, hashes) => {
  if (!headers.includes(INLINE_SCRIPT_HASHES_PLACEHOLDER)) {
    throw new Error(`_headers: ${INLINE_SCRIPT_HASHES_PLACEHOLDER} topilmadi`);
  }
  if (hashes.length === 0) {
    throw new Error("index.html: ichki skript xeshi hisoblanmadi");
  }
  return headers.split(INLINE_SCRIPT_HASHES_PLACEHOLDER).join(hashes.join(" "));
};
