import { parseOptionalAmountInput } from "./amountInput";
import { SHIFT_DIFF_TONE, computeShiftDiff, shiftDiffKind } from "./shiftDiff";

describe("shiftDiff", () => {
  it("classifies the difference: shortage (danger), surplus (warning), match (success), not counted (neutral)", () => {
    expect(shiftDiffKind(-150_000)).toBe("shortage");
    expect(shiftDiffKind(20_000)).toBe("surplus");
    expect(shiftDiffKind(0)).toBe("match");
    // Tiyinlar yaxlitlanadi (backend numeric(20,2)) — 0,4 so'm farq «Mos keldi».
    expect(shiftDiffKind(0.4)).toBe("match");
    expect(shiftDiffKind(null)).toBe("notCounted");
    expect(shiftDiffKind(undefined)).toBe("notCounted");
    expect(shiftDiffKind(Number.NaN)).toBe("notCounted");
    expect(SHIFT_DIFF_TONE).toEqual({ shortage: "danger", surplus: "warning", match: "success", notCounted: "neutral" });
  });

  it("computes counted − expected only when both are known", () => {
    expect(computeShiftDiff(18_090_000, 18_240_000)).toBe(-150_000);
    expect(computeShiftDiff(null, 18_240_000)).toBeNull();
    expect(computeShiftDiff(100, null)).toBeNull();
  });

  it("parseOptionalAmountInput: empty → null (not counted), «0» → 0", () => {
    expect(parseOptionalAmountInput("")).toBeNull();
    expect(parseOptionalAmountInput(undefined)).toBeNull();
    expect(parseOptionalAmountInput("0")).toBe(0);
    expect(parseOptionalAmountInput("18 090 000")).toBe(18_090_000);
  });
});
