import { describe, expect, it } from "vitest";
import {
  ELCHI_MARK_HEIGHT,
  ELCHI_MARK_WIDTH,
  insideElchiMark,
  RECEIPT_WATERMARK_DOT,
  RECEIPT_WATERMARK_PITCH,
  receiptWatermarkRuns,
  receiptWatermarkWidth,
} from "./receiptWatermark";

/** Chek orqa fonidagi xira Elchi belgisi (ega so'rovi 2026-11-09) — shakl va nuqtalar to'ri. */

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

describe("dot grid", () => {
  const height = 36;
  const runs = receiptWatermarkRuns(height);
  const dots = runs.flatMap(([y, x, count]) =>
    Array.from({ length: count }, (_, index) => [x + index * RECEIPT_WATERMARK_PITCH, y] as const),
  );

  it("black dots only where the mark is: every dot centre inside the mark, inside the box", () => {
    const unit = ELCHI_MARK_HEIGHT / height;
    expect(dots.length).toBeGreaterThan(500);
    for (const [x, y] of dots) {
      expect(insideElchiMark(x * unit, y * unit), `${x}, ${y}`).toBe(true);
      expect(x - RECEIPT_WATERMARK_DOT / 2).toBeGreaterThanOrEqual(0);
      expect(x + RECEIPT_WATERMARK_DOT / 2).toBeLessThanOrEqual(receiptWatermarkWidth(height));
      expect(y + RECEIPT_WATERMARK_DOT / 2).toBeLessThanOrEqual(height);
    }
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

  it("is computed once per size (the same frozen array for every label)", () => {
    expect(receiptWatermarkRuns(height)).toBe(runs);
    expect(Object.isFrozen(runs)).toBe(true);
    expect(receiptWatermarkRuns(26)).not.toBe(runs);
  });
});
