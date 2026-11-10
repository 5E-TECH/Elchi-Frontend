import { describe, expect, it } from "vitest";
import {
  ELCHI_CAPTION_POLYGONS,
  ELCHI_LOGO_HEIGHT,
  ELCHI_LOGO_MARK_X,
  ELCHI_LOGO_WIDTH,
  ELCHI_MARK_HEIGHT,
  ELCHI_MARK_WIDTH,
  ELCHI_WORDMARK_POLYGONS,
  insideElchiCaption,
  insideElchiLogo,
  insideElchiMark,
  RECEIPT_WATERMARK_CAPTION_PITCH,
  RECEIPT_WATERMARK_DOT,
  RECEIPT_WATERMARK_PITCH,
  receiptWatermarkCaptionRuns,
  receiptWatermarkRuns,
  receiptWatermarkWidth,
} from "./receiptWatermark";

/**
 * Chek orqa fonidagi xira Elchi belgisi (ega so'rovi 2026-11-09) va uning ostidagi «ELCHI POCHTA» yozuvi
 * (2026-11-10) — shakl va nuqtalar to'ri.
 */

describe("Elchi mark shape", () => {
  it("head, both arms and both side leaves are inside; gaps and corners are outside", () => {
    // Bosh (doira markazi), qanotlar (yelka), yon barglar, tana.
    expect(insideElchiMark(551, 158)).toBe(true);
    expect(insideElchiMark(150, 220)).toBe(true);
    expect(insideElchiMark(950, 220)).toBe(true);
    expect(insideElchiMark(160, 560)).toBe(true);
    expect(insideElchiMark(940, 560)).toBe(true);
    expect(insideElchiMark(450, 700)).toBe(true);
    expect(insideElchiMark(650, 700)).toBe(true);
    // Qanotlar orasidagi tik tirqish, bosh ustidagi burchaklar, qutining chetlari.
    expect(insideElchiMark(550, 800)).toBe(false);
    expect(insideElchiMark(100, 40)).toBe(false);
    expect(insideElchiMark(1000, 40)).toBe(false);
    expect(insideElchiMark(30, 950)).toBe(false);
    expect(insideElchiMark(1070, 950)).toBe(false);
  });

  it("is left–right symmetric (the mark is)", () => {
    let total = 0;
    let mirrored = 0;
    for (let y = 5; y < ELCHI_MARK_HEIGHT; y += 10) {
      for (let x = 5; x < ELCHI_MARK_WIDTH / 2; x += 10) {
        const left = insideElchiMark(x, y);
        if (!left) continue;
        total += 1;
        if (insideElchiMark(ELCHI_MARK_WIDTH - x, y)) mirrored += 1;
      }
    }
    expect(mirrored / total).toBeGreaterThan(0.97);
  });
});

describe("«ELCHI POCHTA» under the mark (2026-11-10)", () => {
  const boxOf = (polygon: ReadonlyArray<number>) => {
    const xs = polygon.filter((_, index) => index % 2 === 0);
    const ys = polygon.filter((_, index) => index % 2 === 1);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  };
  const boxOfAll = (polygons: ReadonlyArray<ReadonlyArray<number>>) => {
    const boxes = polygons.map(boxOf);
    return {
      x0: Math.min(...boxes.map((box) => box.x0)),
      y0: Math.min(...boxes.map((box) => box.y0)),
      x1: Math.max(...boxes.map((box) => box.x1)),
      y1: Math.max(...boxes.map((box) => box.y1)),
    };
  };

  it("stacks mark → «ELCHI» → «POCHTA», centred, with clear gaps, inside the group box", () => {
    const word = boxOfAll(ELCHI_WORDMARK_POLYGONS);
    const caption = boxOfAll(ELCHI_CAPTION_POLYGONS);
    // Belgi markazda, «ELCHI» guruh enida, «POCHTA» uning ostida markazda.
    expect(Math.abs(ELCHI_LOGO_MARK_X * 2 + ELCHI_MARK_WIDTH - ELCHI_LOGO_WIDTH)).toBeLessThanOrEqual(2);
    expect(word.x0).toBeLessThanOrEqual(2);
    expect(word.x1).toBeGreaterThanOrEqual(ELCHI_LOGO_WIDTH - 2);
    expect(Math.abs(caption.x0 + caption.x1 - ELCHI_LOGO_WIDTH)).toBeLessThanOrEqual(4);
    // Tartib va oraliqlar (belgi y 0–1000).
    expect(word.y0).toBeGreaterThan(ELCHI_MARK_HEIGHT + 50);
    expect(caption.y0).toBeGreaterThan(word.y1 + 30);
    expect(caption.y1).toBeLessThanOrEqual(ELCHI_LOGO_HEIGHT);
  });

  it("five letters in «ELCHI»; «POCHTA» keeps the counters of P, O and A (even–odd holes)", () => {
    expect(ELCHI_WORDMARK_POLYGONS).toHaveLength(5);
    expect(ELCHI_CAPTION_POLYGONS).toHaveLength(9);
    const boxes = ELCHI_CAPTION_POLYGONS.map(boxOf);
    const holes = ELCHI_CAPTION_POLYGONS.filter((_, index) =>
      boxes.some(
        (outer, other) =>
          other !== index &&
          outer.x0 < boxes[index].x0 &&
          outer.y0 < boxes[index].y0 &&
          outer.x1 > boxes[index].x1 &&
          outer.y1 > boxes[index].y1,
      ),
    );
    expect(holes).toHaveLength(3);
    for (const hole of holes) {
      const box = boxOf(hole);
      expect(insideElchiCaption((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)).toBe(false);
    }
  });
});

describe("dot grid", () => {
  const height = 38;
  const unit = ELCHI_LOGO_HEIGHT / height;
  const dotsOf = (runs: ReturnType<typeof receiptWatermarkRuns>, pitch: number) =>
    runs.flatMap(([y, x, count]) =>
      Array.from({ length: count }, (_, index) => [x + index * pitch, y] as const),
    );
  const runs = receiptWatermarkRuns(height);
  const dots = dotsOf(runs, RECEIPT_WATERMARK_PITCH);
  const captionRuns = receiptWatermarkCaptionRuns(height);
  const captionDots = dotsOf(captionRuns, RECEIPT_WATERMARK_CAPTION_PITCH);

  it("black dots only where the mark and «ELCHI» are: every dot centre inside, inside the box", () => {
    expect(dots.length).toBeGreaterThan(500);
    for (const [x, y] of dots) {
      expect(insideElchiLogo(x * unit, y * unit), `${x}, ${y}`).toBe(true);
      expect(x - RECEIPT_WATERMARK_DOT / 2).toBeGreaterThanOrEqual(0);
      expect(x + RECEIPT_WATERMARK_DOT / 2).toBeLessThanOrEqual(receiptWatermarkWidth(height));
      expect(y + RECEIPT_WATERMARK_DOT / 2).toBeLessThanOrEqual(height);
    }
    // «ELCHI» ham chizilgan: belgi qutisidan pastda nuqtalar bor.
    expect(dots.some(([, y]) => y * unit > ELCHI_MARK_HEIGHT + 100)).toBe(true);
  });

  it("«POCHTA»: its own finer grid, dots only inside the letters, legible (≥ 7 rows on the thermal label)", () => {
    expect(captionDots.length).toBeGreaterThan(100);
    for (const [x, y] of captionDots) {
      expect(insideElchiCaption(x * unit, y * unit), `${x}, ${y}`).toBe(true);
      expect(insideElchiLogo(x * unit, y * unit)).toBe(false);
    }
    expect(new Set(captionRuns.map(([y]) => y)).size).toBeGreaterThanOrEqual(7);
    const rows = [...new Set(captionRuns.map(([y]) => y))].sort((a, b) => a - b);
    expect(rows[1] - rows[0]).toBeCloseTo(RECEIPT_WATERMARK_CAPTION_PITCH, 6);
  });

  it("faint: ≈ 11 % of the mark is ink (0,25 mm dot every 0,75 mm, odd rows shifted half a step)", () => {
    expect((RECEIPT_WATERMARK_DOT / RECEIPT_WATERMARK_PITCH) ** 2).toBeCloseTo(0.111, 3);
    const rows = [...new Set(runs.map(([y]) => y))].sort((a, b) => a - b);
    expect(rows[1] - rows[0]).toBeCloseTo(RECEIPT_WATERMARK_PITCH, 6);
    const firstX = (y: number) => Math.min(...runs.filter((run) => run[0] === y).map(([, x]) => x));
    const phase = (x: number) =>
      Math.round(((x - RECEIPT_WATERMARK_PITCH / 2) / RECEIPT_WATERMARK_PITCH) * 2) % 2;
    expect(phase(firstX(rows[10]))).not.toBe(phase(firstX(rows[11])));
  });

  it("is computed once per size and layer (the same frozen array for every label)", () => {
    expect(receiptWatermarkRuns(height)).toBe(runs);
    expect(receiptWatermarkCaptionRuns(height)).toBe(captionRuns);
    expect(Object.isFrozen(runs)).toBe(true);
    expect(Object.isFrozen(captionRuns)).toBe(true);
    expect(receiptWatermarkRuns(26)).not.toBe(runs);
    expect(captionRuns).not.toBe(runs);
  });
});
