import { describe, expect, it } from "vitest";
import { CHART_PALETTE, LEGACY_MAIN, SEMANTIC_TOKENS, TEXT_MUTED } from "./themeTokens";

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
    // Och-mavzu qiymati dark fonda qolsa o'qib bo'lmasdi (dizayn v2 qiymati bilan ~2.6:1,
    // eski palitrada ~1:1) — shuning uchun dark blok tokenni O'ZI qayta aniqlaydi.
    const oldValue = resolveVar(readVar(light, "--color-text-muted"), light)!;
    expect(contrast(oldValue, resolveVar(readVar(dark, "--color-dark-bg-py"), dark, light)!)).toBeLessThan(3);
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
    // v1 kodi ko'chirilgan sari kamayadi (G1 dan keyin 94 ta, G2 dan keyin 45 ta, skaner 1-bosqichida `/scan` v2 ga
    // o'tgach 19 ta, MO-1 da oxirgi v1 route `/market-operators` ko'chgach 7 ta) — chegara glob va naqsh hali biror
    // joyni topayotganini tekshiradi, xolos (har bir topilgan joyda `dark:` jufti — keyingi test, u zaiflashmagan).
    // 0 ga tushsa — v1 qolmagan: bu `describe` bloki butunlay olib tashlanadi.
    expect(uses).toBeGreaterThan(0);
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

/**
 * DIZAYN v2 — `index.css` ↔ `themeTokens.ts` BITTA MANBA.
 * antd (`AntdThemeProvider`) JS nusxadan o'qiydi, Tailwind esa CSS'dan —
 * ikkalasi ajralib ketsa antd kartasi bir rangda, sahifa boshqasida chiziladi
 * (aynan shu "ikki brend" holati dizayn auditida topilgan edi).
 */
describe("dizayn v2 tokenlari: CSS va JS bir xil", () => {
  const light = readBlock(indexCss, "@theme");
  const dark = readBlock(indexCss, ".dark");
  const norm = (v?: string) => v?.replace(/\s+/g, "").toLowerCase();

  for (const theme of ["light", "dark"] as const) {
    it(`⭐ ${theme}: har bir semantik token index.css dagi qiymat bilan teng`, () => {
      const block = theme === "light" ? light : dark;
      const fallback = theme === "light" ? [light] : [dark, light];
      for (const [name, value] of Object.entries(SEMANTIC_TOKENS[theme])) {
        const css = resolveVar(readVar(block, `--color-${name}`) ?? readVar(light, `--color-${name}`), ...fallback);
        expect(norm(css), `--color-${name} (${theme})`).toBe(norm(value));
      }
      const muted = resolveVar(readVar(block, "--color-text-muted"), ...fallback);
      expect(norm(muted)).toBe(norm(TEXT_MUTED[theme]));
      const main = resolveVar(readVar(block, "--color-main") ?? readVar(light, "--color-main"), ...fallback);
      expect(norm(main)).toBe(norm(LEGACY_MAIN[theme]));
      CHART_PALETTE[theme].forEach((hex, i) => {
        expect(norm(resolveVar(readVar(block, `--color-chart-${i + 1}`), ...fallback)), `chart-${i + 1}`).toBe(norm(hex));
      });
    });
  }
});

describe("dizayn v2: asosiy juftliklar WCAG kontrastida", () => {
  const T = SEMANTIC_TOKENS;
  const cases: Array<[string, string, string, number]> = [
    // [nom, matn, fon, minimal nisbat]
    ["light text / bg", T.light.text, T.light.bg, 7],
    ["light text / surface", T.light.text, T.light.surface, 7],
    ["light muted / surface", TEXT_MUTED.light, T.light.surface, 4.5],
    ["light muted / bg", TEXT_MUTED.light, T.light.bg, 4.5],
    ["light action-fg / surface", T.light["action-fg"], T.light.surface, 4.5],
    ["light on-solid / action", T.light["on-solid"], T.light.action, 4.5],
    ["light oq / main", "#ffffff", LEGACY_MAIN.light, 4.5],
    ["light oq / success", "#ffffff", T.light.success, 4.5],
    ["light oq / danger", "#ffffff", T.light.danger, 4.5],
    ["light oq / warning", "#ffffff", T.light.warning, 4.5],
    ["light oq / info", "#ffffff", T.light.info, 4.5],
    ["dark text / bg", T.dark.text, T.dark.bg, 7],
    ["dark text / surface", T.dark.text, T.dark.surface, 7],
    ["dark muted / surface", TEXT_MUTED.dark, T.dark.surface, 4.5],
    ["dark muted / raised", TEXT_MUTED.dark, T.dark.raised, 4.5],
    ["dark action-fg / surface", T.dark["action-fg"], T.dark.surface, 4.5],
    ["dark on-solid / action", T.dark["on-solid"], T.dark.action, 4.5],
    ["dark success-fg / surface", T.dark["success-fg"], T.dark.surface, 4.5],
    ["dark danger-fg / surface", T.dark["danger-fg"], T.dark.surface, 4.5],
    ["dark warning-fg / surface", T.dark["warning-fg"], T.dark.surface, 4.5],
    ["dark info-fg / surface", T.dark["info-fg"], T.dark.surface, 4.5],
    // Eski `main` dark'da asosan oq yozuvli FON (AA) va ba'zan yuzadagi matn (UI 3:1, eski binafshada 3.0 edi).
    ["dark oq / main", "#ffffff", LEGACY_MAIN.dark, 4.5],
    ["dark main / surface", LEGACY_MAIN.dark, T.dark.surface, 3.5],
    // Doim navy orollar (xato sahifasi, skaner) ustidagi urg'u.
    ["nav-accent / navy (light)", T.light["nav-accent"], T.light.nav, 4.5],
    ["dark warning-fg / raised", T.dark["warning-fg"], T.dark.raised, 4.5],
    // Avatar bosh harflari (13px/700) — maket `.el-avatar` / `.el.dark .el-avatar`.
    ["light on-avatar / avatar", T.light["on-avatar"], T.light.avatar, 4.5],
    ["dark on-avatar / avatar", T.dark["on-avatar"], T.dark.avatar, 4.5],
    // Tungi avatar sirtdan ajralib tursin (UI elementi).
    ["dark avatar / surface (chegara)", T.dark.avatar, T.dark.surface, 1.3],
  ];
  for (const [name, fg, bg, min] of cases) {
    it(`${name} >= ${min}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }
});

/**
 * YON MENYU (shell, 2-bosqich): `nav-*` tokenlari maketdagi `--sidebar-*`
 * (design/kit/helmet.html) nusxasi. Ular yarim shaffof — fon `nav` ustiga
 * aralashtirilib (hover/faol holat, son pilyulasi faol band ichida) o'lchanadi.
 *
 * O'lchangan qiymatlar (2026-10-15): kunduzgi — nav-text 9.55, faol band
 * ustida 6.55; on-nav: faol 9.14, son pilyulasi faol band ichida 6.16;
 * nav-muted 4.93. Tungi — nav-text 9.98 (faol 8.17), on-nav faol 14.86,
 * pilyula 9.55, nav-muted 4.38.
 */
describe("dizayn v2: yon menyu (nav) tokenlari kontrasti", () => {
  /** Yarim shaffof `top` rangni `base` ustiga aralashtirib, shaffofsiz `rgb()` beradi. */
  const over = (top: string, base: string) => {
    const [r, g, b, a] = parseColor(top);
    const [br, bgG, bb] = parseColor(base);
    return `rgb(${r * a + br * (1 - a)}, ${g * a + bgG * (1 - a)}, ${b * a + bb * (1 - a)})`;
  };

  for (const theme of ["light", "dark"] as const) {
    const T = SEMANTIC_TOKENS[theme];
    const nav = T.nav;
    const hover = over(T["nav-hover"], nav);
    const active = over(T["nav-active"], nav);
    const countIdle = over(T["nav-count"], nav);
    const countActive = over(T["nav-count"], active);
    const cases: Array<[string, string, string, number]> = [
      // Band matni (14px/500) — AA
      ["nav-text / nav", T["nav-text"], nav, 4.5],
      ["nav-text / nav-hover", T["nav-text"], hover, 4.5],
      ["nav-text / nav-active", T["nav-text"], active, 4.5],
      // hover/faol band matni va son pilyulasi (12px/600) — oq
      ["on-nav / nav", T["on-nav"], nav, 4.5],
      ["on-nav / nav-hover", T["on-nav"], hover, 4.5],
      ["on-nav / nav-active", T["on-nav"], active, 4.5],
      ["on-nav / nav-count", T["on-nav"], countIdle, 4.5],
      ["on-nav / nav-count (faol band ichida)", T["on-nav"], countActive, 4.5],
      // Guruh sarlavhasi: 12px/600, katta harf — kamida 3:1 (amalda AA ham)
      ["nav-muted / nav", T["nav-muted"], nav, 3],
      // Faol band urg'usi (ikonka, chiziq) — UI elementi 3:1
      ["nav-accent / nav-active", T["nav-accent"], active, 3],
    ];
    for (const [name, fg, bg, min] of cases) {
      it(`${theme}: ${name} >= ${min}:1`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
      });
    }
  }

  it("⭐ nav-* nomlari eski `sidebar` aliasi bilan aralashmaydi (u sahifa foni)", () => {
    const light = readBlock(indexCss, "@theme");
    // `--color-sidebar` eski alias — sahifa foni (`bg`), yon menyu emas.
    expect(resolveVar(readVar(light, "--color-sidebar"), light)).toBe(SEMANTIC_TOKENS.light.bg);
    expect(readVar(light, "--color-sidebar-text")).toBeUndefined();
  });
});
