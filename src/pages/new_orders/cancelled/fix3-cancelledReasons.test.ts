import { describe, expect, it } from "vitest";
import {
  CANCELLED_MANUAL_REASONS,
  DEFAULT_CANCELLED_MANUAL_REASON,
  toCancelledManualReason,
} from "./utils";

/**
 * fix3 FE-RET-05 — backend `CancelledManualOverrideReasonDto` (`@IsEnum`) faqat
 * shu 4 ta o'zbekcha qiymatni qabul qiladi; tarjima yorlig'i yuborilmaydi.
 */
describe("cancelled manual override reasons", () => {
  it("qiymatlar backend enum bilan AYNAN bir xil", () => {
    expect(CANCELLED_MANUAL_REASONS.map((reason) => reason.value)).toEqual([
      "QR yirtilgan",
      "QR o'qilmayapti",
      "Label yo'qolgan",
      "QR namlangan yoki xiralashgan",
    ]);
  });

  it("enum qiymati o'zgarmaydi", () => {
    for (const reason of CANCELLED_MANUAL_REASONS) {
      expect(toCancelledManualReason(reason.value)).toBe(reason.value);
    }
  });

  it("tarjima yorlig'i, 'QR buzilgan' fallback'i va bo'sh qiymat — birinchi enum qiymatiga tushadi", () => {
    expect(toCancelledManualReason("QR порван")).toBe(DEFAULT_CANCELLED_MANUAL_REASON);
    expect(toCancelledManualReason("QR is torn")).toBe(DEFAULT_CANCELLED_MANUAL_REASON);
    expect(toCancelledManualReason("QR buzilgan")).toBe(DEFAULT_CANCELLED_MANUAL_REASON);
    expect(toCancelledManualReason("")).toBe(DEFAULT_CANCELLED_MANUAL_REASON);
    expect(toCancelledManualReason(undefined)).toBe("QR yirtilgan");
  });
});
