import { describe, expect, it } from "vitest";
import { readOrderAmountInput } from "./orderAmountInput";

describe("readOrderAmountInput (D-17)", () => {
  it("formatlangan summa (uz/ru — bo'shliq, en — vergul) — raqamlar", () => {
    expect(readOrderAmountInput("1 150 000", "uz")).toEqual({ digits: "1150000", error: null });
    expect(readOrderAmountInput("1 150 000", "ru")).toEqual({ digits: "1150000", error: null });
    expect(readOrderAmountInput("1,150,000", "en")).toEqual({ digits: "1150000", error: null });
    expect(readOrderAmountInput("", "uz")).toEqual({ digits: "", error: null });
  });

  it("⭐ kasr — rad etiladi («12.5» endi jimgina 125 bo'lmaydi)", () => {
    expect(readOrderAmountInput("12.5", "uz")).toEqual({ digits: null, error: "fraction" });
    expect(readOrderAmountInput("12,5", "uz")).toEqual({ digits: null, error: "fraction" });
    expect(readOrderAmountInput("12.5", "en")).toEqual({ digits: null, error: "fraction" });
  });

  it("⭐ minus — rad etiladi", () => {
    expect(readOrderAmountInput("-5000", "uz")).toEqual({ digits: null, error: "negative" });
    expect(readOrderAmountInput("−5000", "uz")).toEqual({ digits: null, error: "negative" });
  });

  it("⭐ 12 xonadan uzun — rad etiladi, 12 xona — qabul", () => {
    expect(readOrderAmountInput("999999999999", "uz")).toEqual({ digits: "999999999999", error: null });
    expect(readOrderAmountInput("1234567890123", "uz")).toEqual({ digits: null, error: "tooLong" });
  });

  it("harflar (masalan «so'm») — avvalgidek tashlanadi", () => {
    expect(readOrderAmountInput("150 000 so'm", "uz")).toEqual({ digits: "150000", error: null });
  });
});
