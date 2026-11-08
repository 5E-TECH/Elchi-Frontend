import { describe, expect, it } from "vitest";
import {
  CORRECTION_REASON_LIMITS,
  correctionAmountDiff,
  correctionAmountState,
  correctionReasonState,
  isValidCorrectionReason,
  normalizeCorrectionReason,
  parseCorrectionAmount,
} from "./validation";

/**
 * T6 N2 — forma tekshiruvi backend bilan bir xil: sabab trim dan keyin 5…500 (gateway xom satrni, finance trim
 * qilinganini tekshiradi), yangi summa > 0 va joriydan farqli; server rad etgan summa o'zgarmaguncha o'chiq.
 */

describe("sabab (5–500, trim)", () => {
  it("holatlar: bo'sh, qisqa (trim bilan), to'g'ri, uzun", () => {
    expect(CORRECTION_REASON_LIMITS).toEqual({ min: 5, max: 500 });
    expect(correctionReasonState("")).toBe("empty");
    expect(correctionReasonState("    ")).toBe("empty");
    expect(correctionReasonState(undefined)).toBe("empty");
    expect(correctionReasonState("Xato")).toBe("short");
    expect(correctionReasonState("  Xato   ")).toBe("short");
    expect(correctionReasonState("Xatoo")).toBe("valid");
    expect(correctionReasonState("x".repeat(500))).toBe("valid");
    expect(correctionReasonState("x".repeat(501))).toBe("long");
    // Xom uzunlik 500 dan oshsa ham, trim dan keyin 500 — to'g'ri (backend trim qilib tekshiradi).
    expect(correctionReasonState(`  ${"x".repeat(500)}  `)).toBe("valid");
    expect(isValidCorrectionReason("Kuryer pulni bermagan")).toBe(true);
    expect(isValidCorrectionReason("abc")).toBe(false);
  });

  it("yuboriladigan sabab trim qilingan", () => {
    expect(normalizeCorrectionReason("  Kuryer pulni bermagan \n")).toBe("Kuryer pulni bermagan");
    expect(normalizeCorrectionReason(null)).toBe("");
  });
});

describe("yangi summa", () => {
  it("maydon qiymati → son (`mode=\"money\"` satri, bo'shliqlar, bo'sh)", () => {
    expect(parseCorrectionAmount("2000000")).toBe(2000000);
    expect(parseCorrectionAmount("2 000 000")).toBe(2000000);
    expect(parseCorrectionAmount("2\u00a0000\u00a0000")).toBe(2000000);
    expect(parseCorrectionAmount(1500.5)).toBe(1500.5);
    expect(parseCorrectionAmount("")).toBeNull();
    expect(parseCorrectionAmount("  ")).toBeNull();
    expect(parseCorrectionAmount(null)).toBeNull();
    expect(parseCorrectionAmount("abc")).toBeNull();
  });

  it("holatlar: bo'sh, 0, joriy bilan bir xil (2 xonagacha), to'g'ri", () => {
    expect(correctionAmountState("", 2400000)).toBe("empty");
    expect(correctionAmountState("0", 2400000)).toBe("zero");
    expect(correctionAmountState(-5, 2400000)).toBe("zero");
    expect(correctionAmountState("2 400 000", 2400000)).toBe("same");
    expect(correctionAmountState(2400000.004, 2400000)).toBe("same");
    expect(correctionAmountState("2 000 000", 2400000)).toBe("valid");
    expect(correctionAmountState(2600000, 2400000)).toBe("valid");
  });

  it("AMOUNT_EXCEEDS dan keyin: rad etilgan qiymat va chegaradan kattasi — `exceeds`, o'zgarsa — `valid`", () => {
    const rejection = { code: "AMOUNT_EXCEEDS" as const, amount: 20000000, max: 7220000 };
    expect(correctionAmountState(20000000, 2400000, rejection)).toBe("exceeds");
    expect(correctionAmountState(9000000, 2400000, rejection)).toBe("exceeds");
    expect(correctionAmountState(7220000, 2400000, rejection)).toBe("valid");
    // `max` siz (`mapMoneyError` zaxirasi) — faqat rad etilgan qiymatning o'zi.
    const noMax = { code: "AMOUNT_EXCEEDS" as const, amount: 20000000, max: null };
    expect(correctionAmountState(20000000, 2400000, noMax)).toBe("exceeds");
    expect(correctionAmountState(19000000, 2400000, noMax)).toBe("valid");
  });

  it("server SAME_AMOUNT (poyga) — rad etilgan qiymat `same`, o'zgarsa `valid`", () => {
    const rejection = { code: "SAME_AMOUNT" as const, amount: 2300000, max: null };
    expect(correctionAmountState(2300000, 2400000, rejection)).toBe("same");
    expect(correctionAmountState(2200000, 2400000, rejection)).toBe("valid");
  });

  it("«Farq» = yangi − joriy", () => {
    expect(correctionAmountDiff(2000000, 2400000)).toBe(-400000);
    expect(correctionAmountDiff(2600000, 2400000)).toBe(200000);
  });
});
