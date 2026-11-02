// BUNDLE DARVOZASI (z4uyw52T, 2UGfsfOl, NIFAnCvf, rzzxMItN, 1l2xJiVA) — `vite build` dan keyin CI'da.
//   - dist/index.html da jsPDF bo'lmasin (u faqat chop etishda dinamik yuklanadi);
//   - entry (index.html dagi barcha js+css) gzip yig'indisi byudjetdan oshmasin;
//   - `rel="modulepreload"` havolalarining gzip yig'indisi ≤ 250 KB (har sahifada, /login da ham yuklanadi);
//   - dist dagi barcha CSS yig'indisi ≤ 350 KB xom / 45 KB gzip (render-bloklovchi — birinchi chizish uni kutadi);
//   - birinchi chizish skripti (`vite.config.ts` → `firstPaintPreload`): fayllari bor, /login ro'yxatida
//     tarjimalar va antd yo'q;
//   - dist/assets/*.js da Safari 15 dan yuqori sintaksis yo'q (`static {}`, `??=`, private maydon …) — js9ndYwA,
//     `vite.config.ts` → `build.target`;
//   - dist/_headers bor va xeshli `assets/` — `Cache-Control: public, max-age=31536000, immutable` (04YKjCOD);
//   - index.html ga yangi eager chunk qo'shilsa — ogohlantirish (snapshot).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = process.argv[2] ?? "dist";
const ENTRY_BUDGET_BYTES = 600 * 1024;
const MODULEPRELOAD_BUDGET_BYTES = 250 * 1024;
const CSS_RAW_BUDGET_BYTES = 350 * 1024;
const CSS_GZIP_BUDGET_BYTES = 45 * 1024;
// Kutilgan eager chunklar (hash'siz). Yangisi paydo bo'lsa — ko'rib chiqish kerak.
const EXPECTED_ENTRY_CHUNKS = [
  "index.css",
  "index.js",
  "vendor-i18n.js",
  "vendor-icons.js",
  "vendor-query.js",
  "vendor-react.js",
  "vendor-router.js",
  "vendor-state.js",
];

const html = readFileSync(join(DIST, "index.html"), "utf8");
const refs = [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))];
let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`::error::${message}`);
};

if (/jspdf/i.test(html)) fail("dist/index.html jsPDF chunkini eager yuklayapti — u faqat dinamik import orqali kelishi kerak.");

let total = 0;
const rows = refs.map((ref) => {
  const gz = gzipSync(readFileSync(join(DIST, ref)), { level: 9 }).length;
  total += gz;
  return { ref, gz, name: ref.replace(/^assets\//, "").replace(/-[\w-]{8}(?=\.(js|css)$)/, "") };
});
rows.sort((a, b) => b.gz - a.gz).forEach((row) => console.log(`${String(row.gz).padStart(8)} B gz  ${row.ref}`));
console.log(`Entry gzip: ${(total / 1024).toFixed(1)} KB (byudjet ${ENTRY_BUDGET_BYTES / 1024} KB)`);
if (total > ENTRY_BUDGET_BYTES) fail(`Entry payload ${(total / 1024).toFixed(1)} KB gzip — byudjet ${ENTRY_BUDGET_BYTES / 1024} KB.`);

const preloaded = new Set([...html.matchAll(/rel="modulepreload"[^>]*href="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
const preloadTotal = rows.filter((row) => preloaded.has(row.ref)).reduce((sum, row) => sum + row.gz, 0);
console.log(`modulepreload gzip: ${(preloadTotal / 1024).toFixed(1)} KB (byudjet ${MODULEPRELOAD_BUDGET_BYTES / 1024} KB)`);
if (preloadTotal > MODULEPRELOAD_BUDGET_BYTES) {
  fail(`modulepreload havolalari ${(preloadTotal / 1024).toFixed(1)} KB gzip — byudjet ${MODULEPRELOAD_BUDGET_BYTES / 1024} KB.`);
}

const cssFiles = readdirSync(join(DIST, "assets")).filter((name) => name.endsWith(".css"));
let cssRaw = 0;
let cssGzip = 0;
for (const file of cssFiles) {
  const css = readFileSync(join(DIST, "assets", file));
  cssRaw += css.length;
  cssGzip += gzipSync(css, { level: 9 }).length;
}
console.log(
  `CSS jami (${cssFiles.length} fayl): ${(cssRaw / 1024).toFixed(1)} KB xom / ${(cssGzip / 1024).toFixed(1)} KB gzip (byudjet ${CSS_RAW_BUDGET_BYTES / 1024} / ${CSS_GZIP_BUDGET_BYTES / 1024} KB)`,
);
if (cssRaw > CSS_RAW_BUDGET_BYTES) fail(`CSS jami ${(cssRaw / 1024).toFixed(1)} KB xom — byudjet ${CSS_RAW_BUDGET_BYTES / 1024} KB.`);
if (cssGzip > CSS_GZIP_BUDGET_BYTES) fail(`CSS jami ${(cssGzip / 1024).toFixed(1)} KB gzip — byudjet ${CSS_GZIP_BUDGET_BYTES / 1024} KB.`);

const firstPaint = /const f=(\{"login":\[[^\]]*\],"app":\[[^\]]*\]\})/.exec(html);
if (!firstPaint) {
  fail("dist/index.html da birinchi chizish skripti (firstPaintPreload) topilmadi.");
} else {
  const lists = JSON.parse(firstPaint[1]);
  for (const href of [...lists.login, ...lists.app]) {
    if (!existsSync(join(DIST, href.replace(/^\//, "")))) fail(`birinchi chizish skriptidagi fayl yo'q: ${href}`);
  }
  const heavy = lists.login.filter((href) => /uzRest|locale-|antd|jspdf/i.test(href));
  if (heavy.length) fail(`/login oldindan yuklash ro'yxatida og'ir chunk: ${heavy.join(", ")}`);
  if (!lists.app.some((href) => /uzRest/.test(href))) fail("birinchi chizish skriptida uzRest (tarjimalar) yo'q.");
}

// Brauzer bazasi Safari / iOS 15.4 (js9ndYwA): ES2021–2022 sintaksisi build.target bilan tushirilishi kerak.
const MODERN_SYNTAX = [
  ["static {} bloki", /\bstatic\s*\{/g],
  ["??=", /\?\?=/g],
  ["||=", /\|\|=/g],
  ["&&=", /&&=/g],
  ["private maydon (#x=)", /[{;,\s]#[A-Za-z_$][\w$]*\s*=(?!=)/g],
];
const modern = [];
for (const file of readdirSync(join(DIST, "assets")).filter((name) => name.endsWith(".js"))) {
  const code = readFileSync(join(DIST, "assets", file), "utf8");
  for (const [name, pattern] of MODERN_SYNTAX) {
    const count = code.match(pattern)?.length ?? 0;
    if (count) modern.push(`${file}: ${name} ×${count}`);
  }
}
if (modern.length) fail(`Safari 15 dan yuqori sintaksis (build.target tushirmagan): ${modern.join("; ")}`);
else console.log("Sintaksis: Safari 15 bazasidan yuqorisi yo'q.");

// Kesh sarlavhalari (04YKjCOD): `public/_headers` dist'ga tushgan, xeshli `assets/` — 1 yil + immutable.
const headersFile = join(DIST, "_headers");
if (!existsSync(headersFile)) fail("dist/_headers yo'q — Cloudflare sarlavhalari (CSP, kesh) deploy'ga tushmaydi.");
else if (!/^\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m.test(readFileSync(headersFile, "utf8"))) {
  fail("dist/_headers: `/assets/*` uchun `Cache-Control: public, max-age=31536000, immutable` yo'q — har yuklashda 304.");
} else console.log("Kesh: dist/_headers — /assets/* 1 yil, immutable.");

const unexpected = rows.map((row) => row.name).filter((name) => !EXPECTED_ENTRY_CHUNKS.includes(name));
if (unexpected.length) console.warn(`::warning::index.html ga yangi eager chunk qo'shildi: ${unexpected.join(", ")} — kerakmi, tekshiring.`);

process.exit(failed ? 1 : 0);
