// BUNDLE DARVOZASI (z4uyw52T, 2UGfsfOl, NIFAnCvf) — `vite build` dan keyin CI'da.
//   - dist/index.html da jsPDF bo'lmasin (u faqat chop etishda dinamik yuklanadi);
//   - entry (index.html dagi barcha js+css) gzip yig'indisi byudjetdan oshmasin;
//   - index.html ga yangi eager chunk qo'shilsa — ogohlantirish (snapshot).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = process.argv[2] ?? "dist";
const ENTRY_BUDGET_BYTES = 600 * 1024;
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

const unexpected = rows.map((row) => row.name).filter((name) => !EXPECTED_ENTRY_CHUNKS.includes(name));
if (unexpected.length) console.warn(`::warning::index.html ga yangi eager chunk qo'shildi: ${unexpected.join(", ")} — kerakmi, tekshiring.`);

process.exit(failed ? 1 : 0);
