import { describe, expect, it } from "vitest";
import indexCss from "../index.css?raw";

/**
 * iOS ZOOM QO'RIQCHISI (gUSTfU2h).
 * iOS Safari 16px dan kichik inputga fokusda sahifani kattalashtiradi va
 * qaytarmaydi. Telefon (md dan tor) o'lchamida input/textarea/select ning O'Z
 * className'i `text-xs`/`text-sm` bo'lmasin — kichik ko'rinish kerak bo'lsa
 * `text-base md:text-sm` (telefonda 16px, desktopda avvalgidek 14px).
 */
const sources = import.meta.glob("../**/*.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

/** Teg ochilishidan `>` gacha (JSX ifodalari ichidagi `>` larni hisobga olib). */
const tagSource = (text: string, start: number) => {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
};

// Telefon kengligida amal qiladigan kichik o'lcham: prefikssiz yoki `sm:` bilan.
const SMALL_ON_PHONE = /(^|[\s"'`{])(?:sm:)?text-(?:xs|sm|\[1[0-5]px\])(?=[\s"'`}]|$)/;

const findSmallInputs = () =>
  Object.entries(sources)
    .filter(([path]) => !path.includes(".test."))
    .flatMap(([path, text]) => {
    return [...text.matchAll(/<(input|textarea|select)\b/g)]
      .map((m) => ({ tag: tagSource(text, m.index!), index: m.index! }))
      .filter(({ tag }) => !/type=["'](?:checkbox|radio|hidden|file|range|color)["']/.test(tag) && SMALL_ON_PHONE.test(tag))
      .map(({ index }) => `${path.replace(/^\.\.\//, "")}:${text.slice(0, index).split("\n").length}`);
    });

describe("input font-size guard (iOS focus zoom)", () => {
  it("scans the source tree", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
  });

  it("no input/textarea/select is smaller than 16px on phones", () => {
    expect(findSmallInputs()).toEqual([]);
  });
});

describe("global mobile input rule", () => {
  it("index.css forces 16px inputs below 768px (covers antd inputs too)", () => {
    expect(indexCss).toMatch(/@media \(max-width: 767px\)\s*{\s*input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),\s*select,\s*textarea\s*{\s*font-size: 16px;/);
  });
});
