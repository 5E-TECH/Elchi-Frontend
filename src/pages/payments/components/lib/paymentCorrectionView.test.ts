import { describe, expect, it } from "vitest";
import i18n from "../../../../i18n";
import { replacementRefText, reversalRefText } from "./paymentCorrectionView";

/**
 * T6-FE-1 (XXyAZ9ge) — ro'yxat pastki qatori: teskari yozuvga havola. Backend `correction` qidiruvi yiqilsa
 * (fail-open, `correction: null`) teskari yozuv qatori belgini manba turidan oladi — pastki qator ham sabab (`comment`)
 * emas, `reverses_history_id` dan qisqa «#id qaytarildi».
 */

const t = i18n.getFixedT("uz", "payments") as unknown as (key: string, options?: Record<string, unknown>) => string;
const viewer = { role: "superadmin", cashboxType: "main" };

describe("reversalRefText", () => {
  it("correction kelmagan teskari yozuv — «#4512 qaytarildi» (ikkala ko'rinishda)", () => {
    const row = { source_type: "payment_reversal", reverses_history_id: "4512", correction: null };
    expect(reversalRefText(row, t, viewer, "short")).toBe("#4512 qaytarildi");
    expect(reversalRefText(row, t, viewer, "overview")).toBe("#4512 qaytarildi");
  });

  it("correction kelmagan, asl ID yo'q — `null`; teskari yozuv bo'lmagan qator — `null`", () => {
    expect(reversalRefText({ source_type: "payment_reversal", correction: null }, t, viewer, "overview")).toBeNull();
    expect(reversalRefText({ source_type: "courier_payment", correction: null }, t, viewer, "overview")).toBeNull();
    expect(reversalRefText({ source_type: "courier_payment", correction: null }, t, viewer, "short")).toBeNull();
  });

  it("correction bilan — amal va ko'rinish bo'yicha; boshqa rol — `null`", () => {
    const reversal = (action: string) => ({
      source_type: "payment_reversal",
      reverses_history_id: "4511",
      correction: {
        role: "reversal",
        action,
        payment_kind: "courier_payment",
        related: { id: "4511", role: "original", source_type: "courier_payment" },
      },
    });
    expect(reversalRefText(reversal("reverse"), t, viewer, "overview")).toBe("#4511 · Kuryer to'lovi qaytarildi");
    expect(reversalRefText(reversal("reverse"), t, viewer, "short")).toBe("#4511 qaytarildi");
    expect(reversalRefText(reversal("edit"), t, viewer, "overview")).toBe("#4511 · summa tahrirlandi");
    const original = { source_type: "courier_payment", correction: { role: "original", action: "reverse" } };
    expect(reversalRefText(original, t, viewer, "overview")).toBeNull();
  });
});

describe("replacementRefText", () => {
  it("«Tuzatilgan» — «#4498 o'rniga»; correction kelmagan qator — `null`", () => {
    const row = {
      source_type: "market_payment",
      correction: { role: "replacement", action: "edit", related: { id: "4498", role: "original" } },
    };
    expect(replacementRefText(row, t)).toBe("#4498 o'rniga");
    expect(replacementRefText({ source_type: "market_payment", correction: null }, t)).toBeNull();
  });
});
