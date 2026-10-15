import { describe, expect, it } from "vitest";
import { formatCompactAxisMoney, formatCompactMoney } from "./designSystem";

/**
 * Grafik o'qi 2 xonagacha aniqlik oladi: 1 xonali yaxlitlash bir xil oraliqli
 * o'qda notekis yorliqlar beradi (1,05 mln → "1,1 mln", 1,95 mln → "2 mln").
 */
describe("formatCompactAxisMoney", () => {
  it("o'q yorliqlarini 2 xonagacha, ortiqcha nolsiz chiqaradi", () => {
    expect(formatCompactAxisMoney(1_050_000)).toBe("1,05 mln");
    expect(formatCompactAxisMoney(1_950_000)).toBe("1,95 mln");
    expect(formatCompactAxisMoney(3_000_000)).toBe("3 mln");
    expect(formatCompactAxisMoney(0)).toBe("0");
  });

  it("KPI formatlovchisi 1 xonali bo'lib qoladi", () => {
    expect(formatCompactMoney(1_050_000)).toBe("1,1 mln");
  });
});
