import { describe, expect, it } from "vitest";
import { getPreviousPeriodRange } from "../../../shared/lib/dateRange";
import { calculatePercentChange } from "./periodComparison";

describe("period comparison", () => {
  it("uses an equally long preceding inclusive range", () => {
    expect(getPreviousPeriodRange({ from: "2026-09-01", to: "2026-09-15" })).toEqual({
      from: "2026-08-17",
      to: "2026-08-31",
    });
    expect(getPreviousPeriodRange({ from: "2026-03-01", to: "2026-03-01" })).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
    });
    expect(getPreviousPeriodRange({ from: "2026-03-01", to: "2026-02-28" })).toBeNull();
  });

  it("crosses a real leap-year boundary correctly", () => {
    // 2028 is a leap year — the day before 2028-03-01 is 2028-02-29, not 02-28.
    expect(getPreviousPeriodRange({ from: "2028-03-01", to: "2028-03-01" })).toEqual({
      from: "2028-02-29",
      to: "2028-02-29",
    });
  });

  it("rejects malformed or empty date input instead of throwing", () => {
    expect(getPreviousPeriodRange({ from: "", to: "" })).toBeNull();
    expect(getPreviousPeriodRange({ from: "abc", to: "abc" })).toBeNull();
    expect(getPreviousPeriodRange({ from: "2026-02-30", to: "2026-02-30" })).toBeNull();
  });

  it("matches manual API total arithmetic and leaves missing baselines undefined", () => {
    expect(calculatePercentChange(150_000, 100_000)).toBe(50);
    expect(calculatePercentChange(75, 100)).toBe(-25);
    expect(calculatePercentChange(0, 0)).toBeNull();
    expect(calculatePercentChange(100, undefined)).toBeNull();
  });

  it("treats a zero baseline as unknown even when the current value is non-zero", () => {
    expect(calculatePercentChange(100, 0)).toBeNull();
  });

  it("uses the absolute baseline so a negative-to-negative move keeps the correct sign", () => {
    // current=-50, previous=-100: the value moved UP (loss halved), so the change is +50%,
    // not -50% — this only holds because calculatePercentChange divides by Math.abs(previous).
    expect(calculatePercentChange(-50, -100)).toBe(50);
    expect(calculatePercentChange(-150, -100)).toBe(-50);
  });
});
