import { describe, expect, it } from "vitest";
import {
  SEMANTIC_TOKENS,
  TEXT_MUTED,
  type SemanticToken,
  type ThemeName,
} from "../../config/themeTokens";
import {
  TONES,
  TONE_FG,
  TONE_RING,
  TONE_SOFT,
  TONE_SOLID,
} from "./tone";

/**
 * TON XARITASI — KONTRAST QO'RIQCHISI.
 *
 * Har bir klass juftini `SEMANTIC_TOKENS` (index.css nusxasi, `themeTokens.test.ts`
 * ular tengligini tekshiradi) bo'yicha ikkala mavzuda o'lchaydi. Badge matni
 * 12–14px, shuning uchun chegara 4.5:1 (WCAG AA). Tungi `*-soft` tokenlari
 * yarim shaffof — ular badge turishi mumkin bo'lgan har yuzaga aralashtirilib
 * o'lchanadi.
 */

const THEMES: ThemeName[] = ["light", "dark"];
/** Badge/karta turishi mumkin bo'lgan yuzalar. */
const SURFACES: SemanticToken[] = ["surface", "raised", "bg", "sunken"];
const AA = 4.5;

const tokenValue = (theme: ThemeName, name: string): string => {
  if (name === "text-muted") return TEXT_MUTED[theme];
  const value = (SEMANTIC_TOKENS[theme] as Record<string, string>)[name];
  if (!value) throw new Error(`Noma'lum token: ${name}`);
  return value;
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

/** Yarim shaffof rangni ostidagi (shaffof bo'lmagan) rangga aralashtiradi. */
const blend = (top: string, under: [number, number, number]): [number, number, number] => {
  const [r, g, b, a] = parseColor(top);
  return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)];
};

const luminance = ([r, g, b]: number[]) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** Matn rangi → fon (yuza ustida) kontrasti. */
const contrastOn = (text: string, background: string, surface: string) => {
  const surfaceRgb = blend(surface, [255, 255, 255]);
  const back = blend(background, surfaceRgb);
  const front = blend(text, back);
  const [hi, lo] = [luminance(front), luminance(back)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Klass satridan `bg-*` va `text-*` token nomlarini ajratadi. */
const pairOf = (classes: string) => {
  const bg = classes.match(/(?:^|\s)bg-([a-z-]+)(?:\s|$)/)?.[1];
  const fg = classes.match(/(?:^|\s)text-([a-z-]+)(?:\s|$)/)?.[1];
  return { bg, fg };
};

describe("tone.ts — tuzilma", () => {
  it("har xaritada beshala ton bor", () => {
    for (const map of [TONE_SOFT, TONE_FG, TONE_SOLID, TONE_RING]) {
      expect(Object.keys(map).sort()).toEqual([...TONES].sort());
    }
  });

  it("neutral yumshoq ko'rinish — bg-sunken text-text-muted (CODE-MAP .el-tone-neutral)", () => {
    expect(TONE_SOFT.neutral).toBe("bg-sunken text-text-muted");
  });

  it("har klass faqat mavjud tokenga ishora qiladi (eski nom, palitra yo'q)", () => {
    const all = [TONE_SOFT, TONE_FG, TONE_SOLID, TONE_RING].flatMap((map) => Object.values(map));
    for (const classes of all) {
      for (const cls of classes.split(/\s+/)) {
        const colour = cls.match(/^(?:bg|text|ring)-([a-z-]+?)(?:\/\d+)?$/)?.[1];
        if (!colour || /^(?:1|2|inset)$/.test(colour)) continue;
        for (const theme of THEMES) expect(() => tokenValue(theme, colour), cls).not.toThrow();
      }
    }
  });

  it("halqa — tonning shaffof rangi (`/30`), neutral — border tokeni", () => {
    expect(TONE_RING.neutral).toContain("ring-border");
    for (const tone of TONES.filter((t) => t !== "neutral")) {
      expect(TONE_RING[tone]).toMatch(new RegExp(`ring-${tone}-fg/30`));
    }
  });

  it("to'liq rang — har tonda haqiqiy fon (yumshoq ko'rinishga qaytish yo'q)", () => {
    for (const tone of TONES) expect(TONE_SOLID[tone]).not.toBe(TONE_SOFT[tone]);
  });
});

describe("tone.ts — WCAG kontrast (12–14px matn, ≥ 4.5:1)", () => {
  for (const theme of THEMES) {
    for (const tone of TONES) {
      it(`${theme} · soft · ${tone} — har yuzada`, () => {
        const { bg, fg } = pairOf(TONE_SOFT[tone]);
        expect(bg && fg).toBeTruthy();
        for (const surface of SURFACES) {
          const ratio = contrastOn(tokenValue(theme, fg!), tokenValue(theme, bg!), tokenValue(theme, surface));
          expect(ratio, `${TONE_SOFT[tone]} / ${surface}`).toBeGreaterThanOrEqual(AA);
        }
      });

      it(`${theme} · fg · ${tone} — har yuzada`, () => {
        const fg = TONE_FG[tone].replace(/^text-/, "");
        for (const surface of SURFACES) {
          const value = tokenValue(theme, surface);
          expect(contrastOn(tokenValue(theme, fg), value, value), `${TONE_FG[tone]} / ${surface}`).toBeGreaterThanOrEqual(AA);
        }
      });

      it(`${theme} · solid · ${tone}`, () => {
        const { bg, fg } = pairOf(TONE_SOLID[tone]);
        expect(bg && fg).toBeTruthy();
        for (const surface of SURFACES) {
          const ratio = contrastOn(tokenValue(theme, fg!), tokenValue(theme, bg!), tokenValue(theme, surface));
          expect(ratio, `${TONE_SOLID[tone]} / ${surface}`).toBeGreaterThanOrEqual(AA);
        }
      });
    }
  }

  /**
   * Tungi holat ranglari maketdagidek ochiq (`*-fg` bilan bir xil) — `on-solid`
   * (to'q) ular ustida AA beradi. Kimdir tungi qiymatni yana to'qlashtirsa,
   * to'liq rangli tugma/badge o'qilmay qoladi — bu test ushlaydi.
   */
  it.each<SemanticToken>(["success", "warning", "danger", "info"])(
    "tungi %s = maketdagi *-fg qiymati (to'liq fon ustida on-solid AA)",
    (tone) => {
      expect(tokenValue("dark", tone)).toBe(tokenValue("dark", `${tone}-fg`));
    },
  );
});
