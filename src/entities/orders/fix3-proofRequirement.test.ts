import { describe, expect, it } from "vitest";
import { isProofRequiredByConditions, toKnownAmount } from "./proofRequirement";

/** fix3 FE-ORD-02 — backend `matchExpenseProofConditions` bilan bir xil jadval. */
describe("isProofRequiredByConditions", () => {
  const sell = (extraCost: number, totalPrice: number | null) => ({ action: "sell" as const, extraCost, totalPrice });
  const cancel = (extraCost: number, totalPrice: number | null) => ({ action: "cancel" as const, extraCost, totalPrice });

  it("shart yoqilmagan — hech qachon majburiy emas", () => {
    expect(isProofRequiredByConditions([], sell(5000, 0))).toBe(false);
    expect(isProofRequiredByConditions(null, cancel(5000, 0))).toBe(false);
    expect(isProofRequiredByConditions(undefined, sell(0, 100))).toBe(false);
  });

  it("*_any — doim majburiy", () => {
    expect(isProofRequiredByConditions(["sell_any"], sell(0, 100))).toBe(true);
    expect(isProofRequiredByConditions(["cancel_any"], cancel(0, 100))).toBe(true);
    // Boshqa amalning sharti ta'sir qilmaydi.
    expect(isProofRequiredByConditions(["cancel_any"], sell(0, 100))).toBe(false);
  });

  it("*_extra_cost — faqat xarajat > 0 bo'lsa", () => {
    expect(isProofRequiredByConditions(["sell_extra_cost"], sell(5000, 100))).toBe(true);
    expect(isProofRequiredByConditions(["sell_extra_cost"], sell(0, 100))).toBe(false);
    expect(isProofRequiredByConditions(["cancel_extra_cost"], cancel(1, 100))).toBe(true);
    expect(isProofRequiredByConditions(["cancel_extra_cost"], cancel(0, 100))).toBe(false);
  });

  it("*_zero_total — summa 0 bo'lsa; noma'lum summa (null) tekshirilmaydi", () => {
    expect(isProofRequiredByConditions(["sell_zero_total"], sell(0, 0))).toBe(true);
    expect(isProofRequiredByConditions(["sell_zero_total"], sell(0, 100))).toBe(false);
    expect(isProofRequiredByConditions(["sell_zero_total"], sell(0, null))).toBe(false);
    expect(isProofRequiredByConditions(["cancel_zero_total"], cancel(0, 0))).toBe(true);
  });
});

describe("toKnownAmount", () => {
  it("son bo'lmasa null — taxmin qilinmaydi", () => {
    expect(toKnownAmount(120000)).toBe(120000);
    expect(toKnownAmount("0")).toBe(0);
    expect(toKnownAmount(undefined)).toBeNull();
    expect(toKnownAmount("")).toBeNull();
    expect(toKnownAmount("abc")).toBeNull();
  });
});
