import { describe, expect, it } from "vitest";
import { isUzsCurrency, normalizeReceiptDetail, receiptForeignCurrency, RECEIPT_CURRENCY_NOT_UZS } from "./receipt";

/**
 * Chek boshqa valyutada (backend PR-4, `error_reason: "currency_not_uzs"`): so'm yozuvlari — backend `sanitizeCurrency`
 * (`UZS`, `so'm`, `SUM`, `СУМ`, registrsiz) va `deriveReceiptOutcome` (`currency: null` — mahalliy) bilan bir xil.
 */
describe("isUzsCurrency", () => {
  it.each(["UZS", "uzs", "so'm", "SO'M", "SUM", "сум", null, undefined, "", "  "])("%j — so'm (bo'sh — mahalliy)", (value) => {
    expect(isUzsCurrency(value)).toBe(true);
  });

  it.each(["USD", "usd", "EUR", "RUB", "KZT", "$"])("%j — boshqa valyuta", (value) => {
    expect(isUzsCurrency(value)).toBe(false);
  });
});

describe("receiptForeignCurrency", () => {
  it("boshqa valyuta — ISO kodi katta harfda", () => {
    expect(receiptForeignCurrency({ currency: "usd", error_reason: null })).toEqual({ code: "USD" });
    expect(receiptForeignCurrency({ currency: "EUR", error_reason: RECEIPT_CURRENCY_NOT_UZS })).toEqual({ code: "EUR" });
  });

  it("`currency_not_uzs`, valyuta kelmagan — kodsiz", () => {
    expect(receiptForeignCurrency({ currency: null, error_reason: "currency_not_uzs" })).toEqual({ code: null });
  });

  it("so'mda, valyuta yo'q yoki AI natijasi yo'q — `null`", () => {
    expect(receiptForeignCurrency({ currency: "UZS", error_reason: null })).toBeNull();
    expect(receiptForeignCurrency({ currency: "so'm", error_reason: "no_amount" })).toBeNull();
    expect(receiptForeignCurrency({ currency: null, error_reason: null })).toBeNull();
    expect(receiptForeignCurrency(null)).toBeNull();
  });
});

describe("normalizeReceiptDetail — `ai.difference` va `error_reason`", () => {
  const base = { id: "501", ai_status: "mismatch", entered_amount: "145000" };

  it("`difference: null` null bo'lib qoladi (0 ga aylanmaydi), `currency` va `error_reason` saqlanadi", () => {
    const detail = normalizeReceiptDetail({
      data: { ...base, ai: { amount: 100, difference: null, currency: "USD", error_reason: "currency_not_uzs" } },
    });
    expect(detail?.ai).toMatchObject({ amount: 100, difference: null, currency: "USD", error_reason: "currency_not_uzs" });
    expect(receiptForeignCurrency(detail?.ai)).toEqual({ code: "USD" });
  });

  it("`difference` yo'q yoki bo'sh — null", () => {
    expect(normalizeReceiptDetail({ ...base, ai: {} })?.ai?.difference).toBeNull();
    expect(normalizeReceiptDetail({ ...base, ai: { difference: "" } })?.ai?.difference).toBeNull();
    expect(normalizeReceiptDetail({ ...base, ai: { difference: "5000" } })?.ai?.difference).toBe(5000);
  });
});
