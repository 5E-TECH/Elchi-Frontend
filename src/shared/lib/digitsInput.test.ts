import { describe, expect, it } from "vitest";
import { caretAfterDigits, toDigits } from "./digitsInput";

describe("digitsInput", () => {
  it("toDigits: faqat raqamlar, boshidagi nollarsiz", () => {
    expect(toDigits("1 545 000 so'm")).toBe("1545000");
    expect(toDigits("007")).toBe("7");
    expect(toDigits("0")).toBe("0");
    expect(toDigits("abc")).toBe("");
  });

  it("caretAfterDigits: n ta raqamdan keyingi joy", () => {
    expect(caretAfterDigits("1 545 000", 0)).toBe(0);
    expect(caretAfterDigits("1 545 000", 1)).toBe(1);
    expect(caretAfterDigits("1 545 000", 2)).toBe(3);
    expect(caretAfterDigits("1 545 000", 7)).toBe(9);
    expect(caretAfterDigits("1 545", 9)).toBe(5);
  });
});
