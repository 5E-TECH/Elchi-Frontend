import { describe, expect, it } from "vitest";
import { PAYMENT_DAY_OPTIONS, toPaymentDayOption } from "./paymentDay";

/** «To'lov kuni» — 1–30 ro'yxati (ega qarori 2026-10-16), forma qiymati satr. */
describe("paymentDay", () => {
  it("variantlar «1» … «30» (31 yo'q), qiymat = nom", () => {
    expect(PAYMENT_DAY_OPTIONS).toHaveLength(30);
    expect(PAYMENT_DAY_OPTIONS[0]).toEqual({ value: "1", label: "1" });
    expect(PAYMENT_DAY_OPTIONS[29]).toEqual({ value: "30", label: "30" });
    expect(PAYMENT_DAY_OPTIONS.some((option) => option.value === "31")).toBe(false);
  });

  it("saqlangan qiymat → ro'yxat qiymati; 31, 0, kasr, matn, bo'sh — null (maydon bo'sh)", () => {
    expect(toPaymentDayOption("5")).toBe("5");
    expect(toPaymentDayOption(5)).toBe("5");
    expect(toPaymentDayOption("05")).toBe("5");
    expect(toPaymentDayOption("30")).toBe("30");
    expect(toPaymentDayOption("31")).toBeNull();
    expect(toPaymentDayOption(31)).toBeNull();
    expect(toPaymentDayOption("0")).toBeNull();
    expect(toPaymentDayOption("15.5")).toBeNull();
    expect(toPaymentDayOption("abc")).toBeNull();
    expect(toPaymentDayOption("")).toBeNull();
    expect(toPaymentDayOption(null)).toBeNull();
    expect(toPaymentDayOption(undefined)).toBeNull();
  });
});
