import { describe, expect, it } from "vitest";
import { isUzsCurrency, normalizeReceiptDetail, receiptForeignCurrency, RECEIPT_CURRENCY_NOT_UZS } from "./receipt";

/**
 * Chek boshqa valyutada (backend PR-4, `error_reason: "currency_not_uzs"`): so'm yozuvlari backend `sanitizeCurrency`
 * so'm deb oladiganlarni (`UZS`, `so'm`, `SUM`, `СУМ`, registrsiz) qamraydi va undan kengroq; `currency: null` —
 * mahalliy (`deriveReceiptOutcome` kabi).
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
  const foreign = (currency: string | null, difference: number | null, error_reason: string | null = null) =>
    receiptForeignCurrency({ currency, difference, error_reason });

  it("`error_reason: currency_not_uzs` hal qiluvchi — kod `currency` dan, katta harfda", () => {
    expect(foreign("EUR", null, RECEIPT_CURRENCY_NOT_UZS)).toEqual({ code: "EUR" });
    expect(foreign("usd", null, RECEIPT_CURRENCY_NOT_UZS)).toEqual({ code: "USD" });
    // Farq kelgan bo'lsa ham (backend sababni aytdi).
    expect(foreign("USD", 0, RECEIPT_CURRENCY_NOT_UZS)).toEqual({ code: "USD" });
  });

  it("`currency_not_uzs`, valyuta kelmagan yoki so'm yozuvi — kodsiz", () => {
    expect(foreign(null, null, RECEIPT_CURRENCY_NOT_UZS)).toEqual({ code: null });
    expect(foreign("  ", null, RECEIPT_CURRENCY_NOT_UZS)).toEqual({ code: null });
    expect(foreign("UZS", null, RECEIPT_CURRENCY_NOT_UZS)).toEqual({ code: null });
  });

  it("aniq ISO kodi (≠ UZS), `error_reason` yo'q — farqdan qat'i nazar boshqa valyuta", () => {
    // Bugungi backend (PR #643 gacha): `difference = amount − entered` aralash birlikda (100 USD − 1 250 000 so'm).
    expect(foreign("USD", -1249900)).toEqual({ code: "USD" });
    expect(foreign("usd", null)).toEqual({ code: "USD" });
    expect(foreign("EUR", 0)).toEqual({ code: "EUR" });
  });

  it("noma'lum yozuv (kod emas): farq yo'q — boshqa valyuta, haqiqiy farq bor — backendga ishoniladi (so'm)", () => {
    expect(foreign("$", null)).toEqual({ code: "$" });
    expect(foreign("$", 5000)).toBeNull();
    expect(foreign("dollar", -3)).toBeNull();
  });

  it("so'mda, valyuta yo'q yoki AI natijasi yo'q — `null`", () => {
    expect(foreign("UZS", 5000)).toBeNull();
    expect(foreign("so'm", 5000)).toBeNull();
    // `SUM` — 3 harfli, lekin so'm yozuvi.
    expect(foreign("SUM", null)).toBeNull();
    expect(foreign("so'm", null, "no_amount")).toBeNull();
    expect(foreign(null, null)).toBeNull();
    expect(foreign(null, 5000)).toBeNull();
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
