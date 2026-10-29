import { beforeAll, describe, expect, it } from "vitest";
import { createTestReceiptMeasure, loadTestReceiptFonts } from "../../../test/receiptTestFonts";
import { MM_PER_PT, type ReceiptFontData, type ReceiptMeasure } from "./printReceiptFonts";
import { createPairKerning } from "./printReceiptKerning";

/**
 * HJ5sLHiz — GPOS `kern` o'quvchisi haqiqiy TTF bilan. Kutilgan qiymatlar fontTools bilan olingan (HarfBuzz qoidasi:
 * har lookup — birinchi mos subtable; Manrope: lookup 0 — 1-format juftliklar + 2-format klasslar, lookup 1 — raqam
 * va qavslar). Maket brauzerda shu kerning bilan chizilgan — chek ham (o'lchash va ikkala renderer).
 */

let fonts: ReceiptFontData;
let measure: ReceiptMeasure;
beforeAll(async () => {
  fonts = await loadTestReceiptFonts();
  measure = createTestReceiptMeasure(fonts);
});

const units = (font: string, pairs: string[]) => {
  const kerning = createPairKerning(font);
  return Object.fromEntries(
    pairs.map((pair) => [pair, Math.round(kerning(pair[0], pair[1]) * 2000)]),
  );
};

describe("createPairKerning (GPOS PairPos)", () => {
  it("Manrope Bold: class pairs, format-1 pairs, pairs with a space; tabular digits are not kerned", () => {
    expect(
      units(fonts["manrope-700"], [
        "To",
        "AV",
        "'o",
        "L ",
        "Ya",
        "Уа",
        "ov",
        "mo",
        "Ko",
        "A-",
        "Fa",
        "Ka",
        "11",
      ]),
    ).toEqual({
      To: -160,
      AV: -140,
      "'o": -170,
      "L ": -100,
      Ya: -160,
      Уа: -160,
      ov: -40,
      mo: -17,
      Ko: -80,
      "A-": -80,
      Fa: -40,
      Ka: 0,
      "11": 0,
    });
  });

  it("weights differ where the font differs (Medium «'o» −150, «mo» −10)", () => {
    expect(units(fonts["manrope-500"], ["'o", "mo", "To"])).toEqual({
      "'o": -150,
      mo: -10,
      To: -160,
    });
  });

  it("no GPOS (Noto subset) or unreadable data → 0", () => {
    expect(createPairKerning(fonts["noto-700"])("Қ", "қ")).toBe(0);
    expect(createPairKerning("not a font")("T", "o")).toBe(0);
  });
});

describe("measure with kerning", () => {
  const pt = 10;
  const em = pt * MM_PER_PT;

  it("width = glyph advances + kerning pairs inside one face", () => {
    const separate = measure("T", pt, 700) + measure("o", pt, 700);
    expect(measure("To", pt, 700)).toBeCloseTo(separate - (160 / 2000) * em, 6);
  });

  it("`kerning` lists the split points (index of the right glyph) and offsets in mm", () => {
    expect(measure.kerning?.("To'g'ri", pt, 700)).toEqual([
      [1, expect.closeTo((-160 / 2000) * em, 6)],
      [2, expect.closeTo((-60 / 2000) * em, 6)],
      [3, expect.closeTo((-60 / 2000) * em, 6)],
    ]);
    expect(measure.kerning?.("1 250 000", pt, 700)).toEqual([]);
  });

  it("no kerning across faces (Manrope ↔ Noto), like the browser", () => {
    // «Т» (Manrope) + «қ» (Noto): har biri o'z yuzida, juftlik yo'q.
    expect(measure("Тқ", pt, 700)).toBeCloseTo(measure("Т", pt, 700) + measure("қ", pt, 700), 6);
  });
});
