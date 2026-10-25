import { describe, expect, it } from "vitest";
import { acceptDecodedCode, isValidGtin } from "./barcodeCodes";

describe("GTIN nazorat raqami (CO66kcoB)", () => {
  it.each([
    ["4780123450017", true],
    ["8806095501239", true],
    ["4780156702145", true],
    ["036000291452", true],
    ["96385074", true],
    ["10012345678902", true],
    ["4780123450018", false],
    ["036000291453", false],
    ["96385075", false],
    ["478012345001", false],
    ["12345", false],
    ["47801234500a7", false],
    ["", false],
  ] as const)("%s → %s", (digits, valid) => {
    expect(isValidGtin(digits)).toBe(valid);
  });
});

describe("acceptDecodedCode — nazorat raqami xato kod qabul qilinmaydi", () => {
  it.each([
    ["ean_13", "4780123450017", true],
    ["ean_13", "4780123450018", false],
    ["ean_13", "036000291452", false],
    ["upc_a", "036000291452", true],
    ["upc_a", "036000291453", false],
    ["ean_8", "96385074", true],
    ["ean_8", "96385075", false],
    ["code_128", "ELC-P-000123", true],
    ["code_128", " ", false],
    ["qr_code", "ELC-P-000123", true],
    ["qr_code", "", false],
    ["data_matrix", "0104780123450017", false],
    ["upc_e", "04252614", false],
  ] as const)("%s %s → %s", (format, raw, accepted) => {
    expect(acceptDecodedCode(format, raw)).toBe(accepted);
  });
});
