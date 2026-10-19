import { describe, expect, it } from "vitest";
import {
  COLOUR_RULES,
  isInV2Scope,
  OUTPUT_FORMAT_FILES,
  scanSource,
  scanTree,
  V2_SCOPE_PENDING,
  V2_SCOPES,
  type FileScan,
} from "../../scripts/design-guard.mjs";

/**
 * PALITRA QO'RIQCHISI (RXoR7TIh, gXwlyhqF).
 * `--color-maindark` va `--color-primary` `.dark` blokida yuza bilan bir xil
 * (#252039) yoki umuman qayta aniqlanmagan (#ffffff) — ularni noto'g'ri
 * ishlatish dark rejimda matnni ko'rinmas qiladi (1.08:1, 1.0:1).
 */
const sources = import.meta.glob("../**/*.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const files = Object.entries(sources)
  .filter(([path]) => !path.includes(".test."))
  .map(([path, text]) => ({ path: path.replace(/^\.\.\//, ""), text }));

describe("palette guard", () => {
  it("scans the source tree (the guard must not run on an empty list)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("never uses var(--color-maindark) as an inline text colour", () => {
    const offenders = files.flatMap(({ path, text }) =>
      text
        .split("\n")
        .map((line, i) => ({ line, i }))
        // Faqat inline `style={{ color: ... }}` — Tailwind `text-[color:var(--color-maindark)]`
        // klasslari o'zining `dark:` jufti bilan keladi, ular bu qoidaga kirmaydi.
        .filter(({ line }) => /(^|[\s{,])color:\s*[^,}]*var\(--color-maindark\)/.test(line))
        .map(({ i }) => `${path}:${i + 1}`),
    );
    expect(offenders).toEqual([]);
  });

  it("never uses bg-primary as a surface without a dark: background pair", () => {
    const offenders = files.flatMap(({ path, text }) =>
      [...text.matchAll(/(?:className|class)=\{?[`"']([^`"']*)/g)]
        .map((m) => m[1])
        .filter((cls) => /(^|\s)bg-primary(\s|$)/.test(cls) && !/(^|\s)dark:bg-/.test(cls))
        .map((cls) => `${path}: ${cls.trim().slice(0, 80)}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * DIZAYN v2 (ega qarori 2026-10-09): bitta brend — navy #1f2853 + ko'k
   * action. Eski to'rt brend (#576adb, #7c3aed, antd #6366f1, #7c5cff) mavzu
   * tokenlariga va antd provayderiga QAYTMASLIGI kerak.
   */
  it("index.css mavzu tokenlarida eski brend ranglari yo'q", () => {
    const css = Object.values(
      import.meta.glob("../index.css", { eager: true, query: "?raw", import: "default" }) as Record<string, string>,
    )[0];
    expect(css.length).toBeGreaterThan(1000);
    const legacy = /#(576adb|7c3aed|6366f1|7c5cff|8b5cf6|a5b4fc|4c5798|272c52|252039|2a2540)\b|rgba\((124, ?58, ?237|139, ?92, ?246|99, ?102, ?241|87, ?106, ?219|169, ?152, ?255)/gi;
    expect(css.match(legacy) ?? []).toEqual([]);
  });

  it("AntdThemeProvider ranglarni faqat themeTokens'dan oladi (hex literal yo'q)", () => {
    const provider = Object.entries(
      import.meta.glob("../app/providers/theme/AntdThemeProvider.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>,
    )[0][1];
    const code = provider.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).toContain("themeTokens");
    expect(code.match(/['"]#[0-9a-f]{3,8}['"]/gi) ?? []).toEqual([]);
  });
});

/**
 * DIZAYN v2, 5-bosqich — MIGRATSIYA QILINGAN PAPKALAR (`V2_SCOPES`, scripts/design-guard.mjs).
 * Scope ichidagi har fayl (belgisiz `.ts` yordamchi ham) rang qoidalarida (`COLOUR_RULES`) 0. Istisno ro'yxatlari
 * FAQAT QISQARADI: eskirgan yozuv testni yiqitadi, ro'yxatni o'stirish — shu yerdagi `MAX_*` ni o'zgartirish
 * (review'da ko'rinadi). Unutilgan toza papkani test o'zi topadi.
 */
/** V2_SCOPE_PENDING o'lchami — faqat kamaytiring (bosqich A: 7; bosqich B: 3 — external_orders ×3 v2 ga o'tdi,
 *  UserDetailWidget o'chdi, TransferCourierButton v2; `pages/scan/index.tsx` (kamera ishi) qo'shildi; integratsiya: 2 —
 *  iste'molchisiz v1 `ExtraCostApproval.tsx` o'chirildi). */
const MAX_PENDING = 2;
/** OUTPUT_FORMAT_FILES o'lchami — faqat kamaytiring (dev birlashmasida exportOrdersToExcel.ts o'chdi: 5 → 4). */
const MAX_OUTPUT_FORMAT = 4;
/** `src` dagi stil fayllari — faqat qisqaradi: v2 CSS modul/SCSS yozmaydi (Tailwind + tokenlar). `index.css` —
 *  tokenlar manbai (v1 `Table.module.css` Table bilan birga o'chirildi). */
const STYLE_FILE_ALLOWLIST = ["src/index.css"];

describe("migratsiya qilingan papkalar (V2_SCOPES)", () => {
  const tree = scanTree();
  const byFile = new Map(tree.files.map((f) => [f.file, f]));
  const colourHits = (f: FileScan) => f.violations.filter((v) => COLOUR_RULES.includes(v.rule));
  const colourCount = (f: FileScan) => COLOUR_RULES.reduce((n, id) => n + (f.counts[id] ?? 0), 0);
  const report = (files: FileScan[]) =>
    files
      .flatMap((f) =>
        colourHits(f)
          .slice(0, 10)
          .map((v) => `  ${f.file}:${v.line}:${v.col}  [${v.rule}] ${v.match}  →  ${v.hint}\n      ${v.source}`),
      )
      .join("\n");

  it("har scope papkasi mavjud va qo'riqlanadigan fayli bor; takror va ichma-ich yo'q", () => {
    expect(V2_SCOPES.length).toBeGreaterThan(30);
    const empty = V2_SCOPES.filter((dir) => !tree.files.some((f) => f.file.startsWith(`${dir}/`)));
    expect(empty, "papka yo'q yoki ichida qo'riqlanadigan fayl yo'q — V2_SCOPES dan olib tashlang").toEqual([]);
    expect(new Set(V2_SCOPES).size).toBe(V2_SCOPES.length);
    const nested = V2_SCOPES.filter((dir) => V2_SCOPES.some((other) => other !== dir && dir.startsWith(`${other}/`)));
    expect(nested, "ichma-ich scope — ota papka yetarli").toEqual([]);
    // FSD qatlami ichidagi papka; yagona istisno — `src/auth` (G3: sessiya va kirish, qatlamdan tashqari).
    const DIR = /^src\/(?:(?:pages|widgets|features|entities|shared)\/[\w-]+(?:\/[\w-]+)*|auth)$/;
    for (const dir of V2_SCOPES) expect(dir).toMatch(DIR);
  });

  it("scope ichidagi har fayl rang qoidalarida 0 (belgisiz .ts yordamchi ham)", () => {
    const offenders = tree.files.filter((f) => f.scoped && colourCount(f) > 0);
    expect(
      offenders.map((f) => f.file),
      `V2_SCOPES fayllarida rang buzilishi (ruxsat 0, baseline qo'llanmaydi) — v2 tokeni bilan yozing:\n${report(offenders)}`,
    ).toEqual([]);
  });

  it("toza v2 slice'lar V2_SCOPES da (avtomatik qattiqlashtirish)", () => {
    // slice = src/<qatlam>/<slice>; FSD qatlamidan tashqari papka (`src/auth`, `src/app`) — o'zi slice.
    // ≥ 1 ta `// dizayn-v2:` fayl va rang buzilishi 0 (pending/chiqish fayllari hisobsiz).
    const LAYERS = new Set(["pages", "widgets", "features", "entities", "shared"]);
    const slices = new Map<string, { v2: number; dirty: number }>();
    for (const f of tree.files) {
      const parts = f.file.split("/");
      const depth = LAYERS.has(parts[1]) ? 3 : 2;
      if (parts.length <= depth) continue; // src/<qatlam>/<fayl> yoki src/<fayl> — slice emas
      const slice = parts.slice(0, depth).join("/");
      const s = slices.get(slice) ?? { v2: 0, dirty: 0 };
      slices.set(slice, s);
      if (f.v2) s.v2 += 1;
      if (f.file in V2_SCOPE_PENDING || f.file in OUTPUT_FORMAT_FILES) continue;
      if (colourCount(f) > 0) s.dirty += 1;
    }
    // Bosqich B (G2 + G3 birlashtirildi): istisno yo'q — har toza v2 slice ro'yxatda bo'lishi shart.
    const missing = [...slices]
      .filter(([slice, s]) => s.v2 > 0 && s.dirty === 0 && !isInV2Scope(`${slice}/_`))
      .map(([slice]) => slice);
    expect(
      missing,
      "integrator: papkani V2_SCOPES ga qo'shing (scripts/design-guard.mjs) — ichida v2 fayl bor va rang buzilishi 0",
    ).toEqual([]);
  });

  it("V2_SCOPE_PENDING faqat qisqaradi: fayl bor, scope ichida, hali rang bor, sababi yozilgan", () => {
    const entries = Object.entries(V2_SCOPE_PENDING);
    expect(entries.length, "faqat kamaytiring (MAX_PENDING)").toBeLessThanOrEqual(MAX_PENDING);
    const problems = entries.flatMap(([file, reason]) => {
      const f = byFile.get(file);
      if (!f) return [`${file}: fayl yo'q — ro'yxatdan olib tashlang`];
      const out: string[] = [];
      if (!isInV2Scope(file)) out.push(`${file}: V2_SCOPES dan tashqarida — pending kerak emas`);
      if (f.v2) out.push(`${file}: // dizayn-v2: belgili — ro'yxatdan olib tashlang`);
      if (colourCount(f) === 0) out.push(`${file}: rang buzilishi qolmadi — ro'yxatdan olib tashlang`);
      if (reason.trim().length < 10) out.push(`${file}: sabab yozilmagan (≥ 10 belgi)`);
      return out;
    });
    expect(problems).toEqual([]);
  });

  it("OUTPUT_FORMAT_FILES: faqat /lib/ dagi chop etish / eksport fayllari, hali rang bor, sababi yozilgan", () => {
    const sources = import.meta.glob("../**/lib/*.{ts,tsx}", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;
    const textOf = (file: string) => sources[file.replace(/^src\//, "../")];
    const entries = Object.entries(OUTPUT_FORMAT_FILES);
    expect(entries.length, "faqat kamaytiring (MAX_OUTPUT_FORMAT)").toBeLessThanOrEqual(MAX_OUTPUT_FORMAT);
    const problems = entries.flatMap(([file, reason]) => {
      const text = textOf(file);
      if (!byFile.has(file) || text === undefined)
        return [`${file}: fayl yo'q (yoki /lib/ da emas) — ro'yxatdan olib tashlang`];
      const out: string[] = [];
      const name = file.split("/").pop() ?? "";
      if (!file.includes("/lib/") || !/(print|export|pdf|label)/i.test(name))
        out.push(`${file}: chiqish formati emas (faqat /lib/ dagi print|export|pdf|label)`);
      if (reason.trim().length < 10) out.push(`${file}: sabab yozilmagan (≥ 10 belgi)`);
      // Istisnosiz skanerlanganda hali rang bormi (yo'q bo'lsa — istisno kerak emas).
      if (colourCount(scanSource("src/output-format-probe.ts", text)) === 0)
        out.push(`${file}: rang literal qolmadi — ro'yxatdan olib tashlang`);
      return out;
    });
    expect(problems).toEqual([]);
  });

  it("src dagi stil fayllari — faqat ruxsat ro'yxati (yangi *.module.css / SCSS yo'q)", () => {
    const styles = Object.keys(import.meta.glob("../**/*.{css,scss,sass,less,styl,pcss}"))
      .map((p) => p.replace(/^\.\.\//, "src/"))
      .sort();
    expect(
      styles,
      "v2 da stil faqat Tailwind + tokenlar (src/index.css). Fayl o'chirilgan bo'lsa — STYLE_FILE_ALLOWLIST dan ham olib tashlang",
    ).toEqual(STYLE_FILE_ALLOWLIST);
  });
});
