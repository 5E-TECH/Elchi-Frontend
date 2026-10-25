import { describe, expect, it } from "vitest";
import { extractHandoverPin, readHandoverPinError } from "./handoverPin";

const axiosError = (data: unknown) => ({ isAxiosError: true, response: { status: 400, data } });

describe("handoverPin (zkRab9M2)", () => {
  it("6 xonali kod: bo'shliq va chiziqcha olib tashlanadi, boshidagi nol saqlanadi; boshqa matn — bo'sh", () => {
    expect(extractHandoverPin("042 917")).toBe("042917");
    expect(extractHandoverPin(" 042-917 ")).toBe("042917");
    expect(extractHandoverPin("42917")).toBe("");
    expect(extractHandoverPin("MCR-123456")).toBe("");
    expect(extractHandoverPin("1234567")).toBe("");
  });

  it("backend `data.reason` → tur va qolgan urinishlar; 0 urinishli «invalid» — blok", () => {
    expect(
      readHandoverPinError(axiosError({ data: { reason: "market_cancelled_pin_invalid", details: { remaining_attempts: 2 } } })),
    ).toEqual({ kind: "invalid", remainingAttempts: 2 });
    expect(
      readHandoverPinError(axiosError({ data: { reason: "market_cancelled_pin_invalid", details: { remaining_attempts: 0 } } })),
    ).toEqual({ kind: "blocked", remainingAttempts: 0 });
    expect(readHandoverPinError(axiosError({ data: { reason: "market_cancelled_pin_expired" } }))).toEqual({
      kind: "expired",
      remainingAttempts: null,
    });
    expect(readHandoverPinError(new Error("network"))).toEqual({ kind: "unknown", remainingAttempts: null });
  });
});
