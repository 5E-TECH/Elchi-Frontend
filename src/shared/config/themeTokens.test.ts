import { describe, expect, it } from "vitest";

/**
 * MUTED MATN TOKENI — DARK REJIM QO'RIQCHISI.
 *
 * `--color-text-muted` ilgari faqat och mavzuda aniqlangan edi, dark'da esa
 * faqat `--color-text-muted-dark` jufti bor edi. `dark:` variant yozilmagan
 * har bir joyda (≈76 ta) dark fonda och-mavzu rangi qolib, kontrast
 * 1.00:1 ga tushardi — matn umuman ko'rinmasdi. Endi token dark'da O'ZI
 * qayta aniqlanadi.
 *
 * Fayllar `import.meta.glob` + `?raw` bilan o'qiladi (`node:fs` emas —
 * `integrations/palette.test.ts` izohiga qarang).
 */

const indexCss = Object.values(
  import.meta.glob("../../index.css", { eager: true, query: "?raw", import: "default" }) as Record<string, string>,
)[0];

const sources = import.meta.glob("../../**/*.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Yuqori darajadagi `selector { ... }` blokining ichini qaytaradi. */
const readBlock = (css: string, selector: string): string => {
  const start = css.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m"));
  if (start < 0) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
    }
  }
  return "";
};

const readVar = (block: string, name: string): string | undefined =>
  block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

/** `var(--x)` havolasini shu blok (keyin zaxira blok) ichidan yechadi. */
const resolveVar = (value: string | undefined, ...blocks: string[]): string | undefined => {
  const ref = value?.match(/^var\((--[\w-]+)\)$/)?.[1];
  if (!ref) return value;
  for (const block of blocks) {
    const next = readVar(block, ref);
    if (next) return resolveVar(next, ...blocks);
  }
  return undefined;
};

const parseColor = (value: string): [number, number, number, number] => {
  const rgba = value.match(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  throw new Error(`Rang o'qilmadi: ${value}`);
};

const luminance = ([r, g, b]: number[]) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** Yarim shaffof matnni fonga aralashtirib, WCAG kontrast nisbatini beradi. */
const contrast = (text: string, background: string) => {
  const [r, g, b, a] = parseColor(text);
  const [br, bgG, bb] = parseColor(background);
  const blended = [r * a + br * (1 - a), g * a + bgG * (1 - a), b * a + bb * (1 - a)];
  const [hi, lo] = [luminance(blended), luminance([br, bgG, bb])].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("--color-text-muted dark rejimda", () => {
  const light = readBlock(indexCss, "@theme");
  const dark = readBlock(indexCss, ".dark");

  it("index.css va ikkala blok topildi (test bo'shliqda ishlamasin)", () => {
    expect(indexCss.length).toBeGreaterThan(1000);
    expect(readVar(light, "--color-text-muted")).toBeTruthy();
    expect(readVar(dark, "--color-page-surface")).toBeTruthy();
  });

  it("⭐ dark mavzu tokenning O'ZINI qayta aniqlaydi va u och mavzunikidan farq qiladi", () => {
    const lightValue = resolveVar(readVar(light, "--color-text-muted"), light);
    const darkValue = resolveVar(readVar(dark, "--color-text-muted"), dark, light);

    expect(darkValue).toBeTruthy();
    expect(darkValue).not.toBe(lightValue);
    // `-dark` jufti bilan bir xil — ikkala yozuv ham bir rangni beradi.
    expect(darkValue).toBe(resolveVar(readVar(dark, "--color-text-muted-dark"), dark, light));
  });

  it("⭐ dark yuzalarda WCAG AA kontrastini beradi (>= 4.5:1)", () => {
    const darkValue = resolveVar(readVar(dark, "--color-text-muted"), dark, light)!;

    for (const surface of ["--color-page-surface", "--color-card-surface", "--color-card-surface-strong", "--color-dark-bg-py"]) {
      const background = resolveVar(readVar(dark, surface), dark, light)!;
      expect(contrast(darkValue, background), surface).toBeGreaterThanOrEqual(4.5);
    }
    // Ilgari dark'da och-mavzu qiymati qolardi — xuddi o'sha yuzada ~1:1.
    const oldValue = resolveVar(readVar(light, "--color-text-muted"), light)!;
    expect(contrast(oldValue, resolveVar(readVar(dark, "--color-dark-bg-py"), dark, light)!)).toBeLessThan(2);
  });
});

describe("muted matn dark rejimda oq qoladigan fonda", () => {
  it("fayllar topildi", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it("⭐ `bg-primary`/`bg-white` (dark'da ham oq) bilan birga `dark:bg-*` siz ishlatilmaydi", () => {
    /**
     * Token endi dark'da OCH rangga o'tadi. `--color-primary` dark'da qayta
     * aniqlanmagan, ya'ni `bg-primary` dark'da ham oq — shunday chip ichida
     * muted matn ko'rinmay qolardi. Bunday joy dark fonni o'zi berishi shart.
     */
    const offenders: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      // Ko'p qatorli template class'lar ham (SATO tuman qatorlari shunday edi).
      for (const m of src.matchAll(/"([^"\n]{10,400})"|'([^'\n]{10,400})'|`([^`]{10,1200})`/g)) {
        const cls = m[1] ?? m[2] ?? m[3];
        if (!cls.includes("var(--color-text-muted)")) continue;
        if (/(^|\s)bg-(primary|white)(\s|$)/.test(cls) && !/dark:bg-/.test(cls)) {
          offenders.push(`${file}: ${cls.slice(0, 100)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * REPO SKAN: `…-[color:var(--color-text-muted)]` class'i ishlatilgan HAR BIR
 * joyda o'sha class satrida `dark:` jufti bo'lsin (7L68tqsa).
 *
 * Token dark'da o'zi ham qayta aniqlanadi (yuqoridagi test), lekin karta
 * talabi — juftni unutish imkoniyati qolmasin: yangi joyda `dark:` yozilmasa
 * bu test yiqiladi.
 */
describe("--color-text-muted class'larida dark: jufti", () => {
  const all = {
    ...sources,
    ...(import.meta.glob("../../**/*.ts", { eager: true, query: "?raw", import: "default" }) as Record<string, string>),
  };
  const files = Object.entries(all).filter(([path]) => !/\.test\.tsx?$/.test(path));
  const TOKEN =
    /(?<![\w:\-[])((?:[a-z0-9-]+:)*)([a-z]+(?:-[a-z]+)*)-\[color:var\(--color-text-muted\)\](\/\d+)?/g;

  /** Token turgan class satri: eng yaqin qo'shtirnoqlar orasi. */
  const enclosing = (source: string, index: number): string => {
    const start = Math.max(
      source.lastIndexOf('"', index),
      source.lastIndexOf("'", index),
      source.lastIndexOf("`", index),
    );
    if (start < 0) return source;
    const end = source.indexOf(source[start], index);
    return source.slice(start, end < 0 ? source.length : end);
  };

  it("fayllar va muted class'lar topildi (test bo'shliqda ishlamasin)", () => {
    const uses = files.reduce((sum, [, source]) => sum + (source.match(TOKEN)?.length ?? 0), 0);
    expect(files.length).toBeGreaterThan(50);
    expect(uses).toBeGreaterThan(100);
  });

  it("⭐ har bir `…-[color:var(--color-text-muted)]` yonida `dark:` jufti bor", () => {
    const missing: string[] = [];
    for (const [path, source] of files) {
      for (const match of source.matchAll(TOKEN)) {
        const [token, variants, utility] = match;
        if (variants.includes("dark:")) continue;
        const pair = new RegExp(`dark:${variants.replace(/[-:]/g, "\\$&")}${utility}-`);
        if (!pair.test(enclosing(source, match.index ?? 0))) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${path.replace("../../", "src/")}:${line} ${token}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
