import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import headersFile from "../../public/_headers?raw";
import css from "../index.css?raw";

/**
 * Manrope O'ZIMIZDAN (sekin tarmoq): Google Fonts render-bloklovchi CSS edi — xost sekin/uzilganda sahifa oq turardi.
 * `@font-face` qiymatlari Google `css2?family=Manrope:wght@400..800&display=swap` javobidagidek (greek / vietnamese
 * bo'laklari olinmagan — ilova matnida yo'q, tizim shriftiga tushadi).
 */
const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/;
const SUBSETS: Record<string, string> = {
  "cyrillic-ext": "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
  cyrillic: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
  "latin-ext":
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
  latin:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
};

const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
  const prop = (name: string) => new RegExp(`(?:^|;|\\s)${name}:\\s*([^;]+);`).exec(body)?.[1].trim();
  return {
    family: prop("font-family"),
    weight: prop("font-weight"),
    display: prop("font-display"),
    style: prop("font-style"),
    range: prop("unicode-range"),
    url: /src:\s*url\("\.\/(shared\/assets\/fonts\/Manrope-wght-([\w-]+)\.woff2)"\)\s*format\("woff2"\)/.exec(body),
  };
});

describe("Manrope — o'zimizdan, Google Fonts'siz (sekin tarmoq)", () => {
  it("index.html va CSP'da Google Fonts yo'q (render-bloklovchi tashqi CSS / preconnect qaytmasin)", () => {
    expect(html).not.toMatch(GOOGLE_FONTS);
    expect(css).not.toMatch(GOOGLE_FONTS);
    expect(headersFile).not.toMatch(GOOGLE_FONTS);
  });

  it("4 bo'lak: Google bilan bir xil unicode-range, wght 400 800, swap; fayl bor va haqiqiy woff2", () => {
    expect(faces.map((face) => face.url?.[2])).toEqual(["cyrillic-ext", "cyrillic", "latin-ext", "latin"]);
    for (const face of faces) {
      const subset = face.url![2];
      expect(face.family, subset).toBe('"Manrope"');
      expect(face.weight, subset).toBe("400 800");
      expect(face.display, subset).toBe("swap");
      expect(face.style, subset).toBe("normal");
      expect(face.range, subset).toBe(SUBSETS[subset]);
      const file = resolve(process.cwd(), "src", face.url![1]);
      expect(existsSync(file), file).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 4).toString("latin1"), subset).toBe("wOF2");
      expect(bytes.length, subset).toBeLessThan(30 * 1024);
    }
  });

  it("faqat lotin bo'lagi preload: as=font + type + crossorigin (bo'lmasa ikki marta yuklanadi), @font-face fayli", () => {
    const preloads = [...html.matchAll(/<link rel="preload" as="font"[^>]*>/g)].map(([tag]) => tag);
    expect(preloads).toEqual([
      '<link rel="preload" as="font" type="font/woff2" href="/src/shared/assets/fonts/Manrope-wght-latin.woff2" crossorigin />',
    ]);
    expect(faces.find((face) => face.url?.[2] === "latin")?.url?.[1]).toBe("shared/assets/fonts/Manrope-wght-latin.woff2");
  });
});
