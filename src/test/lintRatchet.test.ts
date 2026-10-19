import { describe, expect, it } from "vitest";
import { maskComments } from "../../scripts/design-guard.mjs";
import {
  DS_LAYER,
  RAW_CONTROL_RATCHET,
  STAGE_A_PENDING,
  TEST_FILES,
  UI_IMPORT_OPTIONS,
  UI_IMPORT_RATCHET,
} from "../../scripts/eslint-design-v2.mjs";

/**
 * DIZAYN v2, 5-bosqich — ESLint istisno ro'yxatlari FAQAT QISQARADI (docs/DESIGN_SYSTEM.md §12.2).
 *
 * `scripts/eslint-design-v2.mjs` dagi ro'yxatlar (`eslint.config.js` o'qiydi):
 *  - `RAW_CONTROL_RATCHET` — xom `<button>`/`<select>`/`<input>`… hali qolgan v1 fayllar (`design-v2/raw-control` off);
 *  - `UI_IMPORT_RATCHET` — antd vizual komponenti / boshqa ikonka kutubxonasi importi qolgan fayllar
 *    (`design-v2/ui-imports` off);
 *  - `STAGE_A_PENDING` — bosqich A da G2/G3 qurilayotgan yo'llar (`warn`) edi; bosqich B (hozir) — `[]`.
 * Fayl tozalansa — ro'yxatdan olib tashlanadi (test shuni talab qiladi). Ro'yxatni o'stirish — quyidagi `MAX_*` ni
 * oshirish, ya'ni review'da ko'rinadigan, sababli o'zgarish. ESLint bu yerda yurmaydi (tez test).
 */

/**
 * Faqat kamaytiring. Bosqich B: 11 → 9 (`UserDetailWidget` G2 da o'chirildi, `TransferCourierButton` v2 ga o'tdi);
 * integratsiya: 9 → 5 (iste'molchisiz v1 `UserInfoCards`, `button.tsx`, `Table.tsx`, `pagination` o'chirildi);
 * skaner 1-bosqich: 5 → 4 (`pages/scan/index.tsx` v2 ga o'tdi).
 */
const MAX_RAW = 4;
/** Faqat kamaytiring. Bosqich B: 1 → 0 (`ConfirmButton` G2 da o'chirildi). */
const MAX_UI = 0;
const MIN_REASON = 10;

// ── yordamchilar (sof funksiyalar — pastda sintetik kirish bilan ham sinaladi) ──────────────────────────────

/** ESLint/minimatch glob'ining kichik to'plami: `**`, `*`, `{a,b}`. */
function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        out += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "{") {
      const end = glob.indexOf("}", i);
      out += `(?:${glob.slice(i + 1, end).split(",").map(escapeRe).join("|")})`;
      i = end;
    } else {
      out += escapeRe(ch);
    }
  }
  return new RegExp(`^${out}$`);
}
const escapeRe = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const matchesAny = (file: string, globs: readonly string[]) => globs.some((g) => globToRegExp(g).test(file));

/** Birinchi qatorda `// dizayn-v2:` belgisi (scripts/design-guard.mjs bilan bir xil qoida). */
const isV2Marked = (text: string) => /^\uFEFF?\s*\/\/\s*dizayn-v2:\s*\S/.test(text.split("\n")[0] ?? "");

/** spec §1.7: xom boshqaruv elementi (izohlar hisobga olinmaydi). */
const RAW_CONTROL_RE =
  /<(?:button|select|textarea|dialog)\b|<input\b(?![^>]*\btype=["'](?:checkbox|radio|file|hidden)["'])|\brole=["']button["']/;
const hasRawControl = (text: string) => RAW_CONTROL_RE.test(maskComments(text));

const ANTD = UI_IMPORT_OPTIONS.paths.find((p) => p.name === "antd");
const ANTD_ALLOWED = new Set(ANTD?.allowImportNames ?? []);
const ICON_GROUP = UI_IMPORT_OPTIONS.patterns.find((p) => p.group.includes("@ant-design/icons"))?.group ?? [];
const isIconLib = (spec: string) =>
  ICON_GROUP.some((g) => (g.endsWith("/*") ? spec.startsWith(g.slice(0, -1)) : spec === g));

/** `design-v2/ui-imports` taqiqlaydigan importlar (antd ruxsatsiz nomi, antd chuqur importi, boshqa ikonka kutubxonasi). */
function bannedUiImports(text: string): string[] {
  const banned: string[] = [];
  const code = maskComments(text);
  for (const m of code.matchAll(/\b(?:import|export)\s+(?:type\s+)?([^;]*?)\s*\bfrom\s*["']([^"']+)["']/g)) {
    const [, clause, spec] = m;
    if (spec === "antd") {
      const named = /\{([\s\S]*)\}/.exec(clause)?.[1] ?? "";
      const names = named
        .split(",")
        .map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      const outside = clause.replace(/\{[\s\S]*\}/, "").replace(/^type\s+/, "").replace(/,/g, " ").trim();
      if (outside) banned.push(`antd: ${outside}`); // default / `* as x` — ruxsat ro'yxatini aylanib o'tadi
      for (const name of names) if (!ANTD_ALLOWED.has(name)) banned.push(`antd: ${name}`);
    } else if (spec.startsWith("antd/") && !/^antd\/locale(\/|$)/.test(spec)) {
      banned.push(spec);
    } else if (isIconLib(spec)) {
      banned.push(spec);
    }
  }
  return banned;
}

/** `eslint-disable…design-v2/…` izohlari, sababsizlari (` -- <sabab>` ≥ MIN_REASON belgi). */
function disablesWithoutReason(file: string, text: string): string[] {
  const bad: string[] = [];
  text.split("\n").forEach((line, i) => {
    const m = /eslint-disable(?:-next-line|-line)?\b(.*)$/.exec(line);
    if (!m || !/design-v2\//.test(m[1])) return;
    const body = m[1].replace(/\*\/.*$/, "");
    const reason = /\s--\s+(.*)$/.exec(body)?.[1].trim() ?? "";
    if (reason.length < MIN_REASON) bad.push(`${file}:${i + 1}: ${line.trim()}`);
  });
  return bad;
}

const reasonProblems = (list: Record<string, string>) =>
  Object.entries(list)
    .filter(([, reason]) => reason.trim().length < MIN_REASON)
    .map(([file]) => file);

// ── manba daraxti ─────────────────────────────────────────────────────────────────────────────────────────

const sources = import.meta.glob("../**/*.{ts,tsx}", { eager: true, query: "?raw", import: "default" }) as Record<
  string,
  string
>;
const FILES = new Map(Object.entries(sources).map(([path, text]) => [`src/${path.replace(/^\.\.\//, "")}`, text]));

describe("lint ratchet — yordamchilar (sintetik kirish)", () => {
  it("glob: **, *, {a,b}", () => {
    expect(globToRegExp("src/pages/scan/**").test("src/pages/scan/ui/A.tsx")).toBe(true);
    expect(globToRegExp("src/pages/scan/**").test("src/pages/scanner/A.tsx")).toBe(false);
    expect(globToRegExp("src/**/*.test.{ts,tsx}").test("src/a/b/C.test.tsx")).toBe(true);
    expect(globToRegExp("src/**/*.test.{ts,tsx}").test("src/C.test.ts")).toBe(true);
    expect(globToRegExp("src/**/*.test.{ts,tsx}").test("src/a/C.tsx")).toBe(false);
    expect(globToRegExp("src/pages/scan/detail.tsx").test("src/pages/scan/detail.tsx")).toBe(true);
  });

  it("xom element: tozalangan fayl → ratchet'dan olib tashlash talab qilinadi", () => {
    expect(hasRawControl(`<button type="button" />`)).toBe(true);
    expect(hasRawControl(`<input value={v} />`)).toBe(true);
    expect(hasRawControl(`<input type="password" />`)).toBe(true);
    expect(hasRawControl(`<div role="button" />`)).toBe(true);
    expect(hasRawControl(`<Pressable className="x" />`)).toBe(false);
    expect(hasRawControl(`<input type="checkbox" /><input type="file" />`)).toBe(false);
    expect(hasRawControl(`// <button> izohda\n/* <select> */\n<Button />`)).toBe(false);
  });

  it("taqiqlangan import: antd ruxsatsiz nomi, chuqur import, ikonka kutubxonasi", () => {
    expect(bannedUiImports(`import { Button, QRCode } from "antd";`)).toEqual(["antd: Button"]);
    expect(bannedUiImports(`import type { TableColumnsType } from "antd";`)).toEqual(["antd: TableColumnsType"]);
    expect(bannedUiImports(`import * as antd from "antd";`)).toEqual(["antd: * as antd"]);
    expect(bannedUiImports(`import { ConfigProvider, theme } from "antd";\nimport uz from "antd/locale/uz_UZ";`)).toEqual([]);
    expect(bannedUiImports(`import Btn from "antd/es/button";`)).toEqual(["antd/es/button"]);
    expect(bannedUiImports(`import { EditOutlined } from "@ant-design/icons";`)).toEqual(["@ant-design/icons"]);
    expect(bannedUiImports(`import { FaBeer } from "react-icons/fa";`)).toEqual(["react-icons/fa"]);
    expect(bannedUiImports(`import { Pencil } from "lucide-react";`)).toEqual([]);
    expect(bannedUiImports(`// import { Table } from "antd";`)).toEqual([]);
  });

  it("design-v2 istisno izohi sababsiz → xato; boshqa qoidalar tekshirilmaydi", () => {
    const D = "eslint-disable"; // shu fayl daraxt skanerida o'zini ushlamasin
    expect(disablesWithoutReason("a.tsx", `// ${D}-next-line design-v2/raw-control`)).toHaveLength(1);
    expect(disablesWithoutReason("a.tsx", `{/* ${D}-next-line design-v2/raw-control -- qisqa */}`)).toHaveLength(1);
    expect(disablesWithoutReason("a.tsx", `{/* ${D}-next-line design-v2/raw-control -- kamera ishi: alohida */}`)).toEqual([]);
    expect(disablesWithoutReason("a.tsx", `// ${D}-next-line design-v2/ui-imports -- QR chizuvchi, primitiv yo'q`)).toEqual([]);
    expect(disablesWithoutReason("a.tsx", `// ${D}-next-line react-hooks/exhaustive-deps`)).toEqual([]);
  });

  it("bo'sh yoki qisqa sabab topiladi", () => {
    expect(reasonProblems({ "a.tsx": "", "b.tsx": "   ", "c.tsx": "kamera ishi — alohida" })).toEqual(["a.tsx", "b.tsx"]);
  });
});

describe("lint ratchet — ro'yxatlar faqat qisqaradi", () => {
  it("manba daraxti skanerlandi", () => {
    expect(FILES.size).toBeGreaterThan(500);
    expect(FILES.has("src/shared/ui/primitives/Pressable.tsx")).toBe(true);
  });

  it("har ratchet fayli mavjud, `// dizayn-v2:` belgisiz, sababi yozilgan", () => {
    for (const list of [RAW_CONTROL_RATCHET, UI_IMPORT_RATCHET]) {
      for (const file of Object.keys(list)) {
        expect(FILES.has(file), `${file} — fayl yo'q: ro'yxatdan olib tashlang`).toBe(true);
        expect(isV2Marked(FILES.get(file) ?? ""), `${file} — v2 fayl ratchet'da bo'lmaydi (Pressable / primitiv)`).toBe(false);
      }
      expect(reasonProblems(list), "sabab bo'sh yoki juda qisqa").toEqual([]);
    }
  });

  it("RAW_CONTROL_RATCHET: har faylda hali xom element bor (tozalangan bo'lsa — ro'yxatdan olib tashlang)", () => {
    const clean = Object.keys(RAW_CONTROL_RATCHET).filter((file) => FILES.has(file) && !hasRawControl(FILES.get(file) ?? ""));
    expect(clean, "xom element qolmagan — RAW_CONTROL_RATCHET dan olib tashlang").toEqual([]);
  });

  it("RAW_CONTROL_RATCHET: dizayn tizimi qatlami yoki test fayli ro'yxatda emas (ular doim ruxsat)", () => {
    const redundant = Object.keys(RAW_CONTROL_RATCHET).filter((file) => matchesAny(file, [...DS_LAYER, ...TEST_FILES]));
    expect(redundant).toEqual([]);
  });

  it("UI_IMPORT_RATCHET: har faylda hali taqiqlangan import bor (tozalangan bo'lsa — ro'yxatdan olib tashlang)", () => {
    const clean = Object.keys(UI_IMPORT_RATCHET).filter((file) => FILES.has(file) && !bannedUiImports(FILES.get(file) ?? "").length);
    expect(clean, "taqiqlangan import qolmagan — UI_IMPORT_RATCHET dan olib tashlang").toEqual([]);
  });

  it(`o'lcham: RAW ≤ ${MAX_RAW}, UI ≤ ${MAX_UI} (faqat kamaytiring)`, () => {
    expect(Object.keys(RAW_CONTROL_RATCHET).length).toBeLessThanOrEqual(MAX_RAW);
    expect(Object.keys(UI_IMPORT_RATCHET).length).toBeLessThanOrEqual(MAX_UI);
  });

  it("har `eslint-disable … design-v2/…` izohida ` -- <sabab>` bor", () => {
    const bad = [...FILES].flatMap(([file, text]) => disablesWithoutReason(file, text));
    expect(bad).toEqual([]);
  });

  it("bosqich B: STAGE_A_PENDING bo'sh — `design-v2/*` hamma joyda xato (spec §1.8)", () => {
    // G2 va G3 asosiy branchga qo'shilgan. Qurilayotgan yangi yo'l uchun ham `warn` qaytmaydi:
    // `Pressable` / primitiv, asosli `eslint-disable-next-line … -- <sabab>` yoki ratchet (`MAX_*` bilan).
    expect(STAGE_A_PENDING).toEqual([]);
  });
});
