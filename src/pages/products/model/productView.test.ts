import { describe, expect, it } from "vitest";
import { formatProductPrice, isPriceInputValid, toPriceInput } from "./productView";

describe("productView — narx", () => {
  it("isPriceInputValid: bo'sh mumkin, 12 xonagacha; boshidagi nollar sanalmaydi", () => {
    expect(isPriceInputValid("")).toBe(true);
    expect(isPriceInputValid("999999999999")).toBe(true);
    expect(isPriceInputValid("1000000000000")).toBe(false);
    // Qiymat tashqaridan (masalan eski qoralama) nollar bilan kelsa — ko'rinishi «1», xato chiqmasin.
    expect(isPriceInputValid("0000000000001")).toBe(true);
    expect(isPriceInputValid("0")).toBe(true);
  });

  it("formatProductPrice: butun so'm — kasrsiz, tiyinli narx yaxlitlanmaydi", () => {
    expect(formatProductPrice(189000, "uz")).toBe("189 000 so'm");
    expect(formatProductPrice(1250000.5, "uz")).toBe("1 250 000,5 so'm");
    expect(formatProductPrice(1250000.25, "ru")).toBe("1 250 000,25 сум");
    expect(formatProductPrice(1250000.25, "en")).toBe("1,250,000.25 UZS");
  });

  it("toPriceInput: narx yo'q — bo'sh, bor — butun so'm raqamlari", () => {
    expect(toPriceInput({ id: 1, name: "A", price: null })).toBe("");
    expect(toPriceInput({ id: 1, name: "A", price: "189000.00" })).toBe("189000");
  });
});
