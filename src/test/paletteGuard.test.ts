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
});
