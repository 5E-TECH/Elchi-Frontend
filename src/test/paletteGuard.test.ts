import { describe, expect, it } from "vitest";

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
