import { describe, expect, it } from "vitest";
import { appendProductBarcode, checkBarcodeInput, isDuplicateBarcodeError, qrPath } from "./productCode";
import { LABEL_SPECS, labelHtml, labelsDocument } from "./productLabelPrint";

describe("shtrix kod tekshiruvi (yXC91RRx)", () => {
  it.each([
    ["", null],
    ["4780123450017", null],
    ["8806095501239", null],
    ["036000291452", null],
    ["04963406", null],
    ["10012345678902", null],
    ["4780123450018", "checksum"],
    ["12345", "length"],
    ["478012345001", "checksum"],
    ["(01)04780123450017", null],
  ] as const)("%s → %s", (value, issue) => {
    expect(checkBarcodeInput(value)).toBe(issue);
  });

  it("FormData ga faqat o'zgargan kod; bo'sh — kodni olib tashlash", () => {
    const same = new FormData();
    appendProductBarcode(same, " 4780123450017 ", "4780123450017");
    expect(same.has("barcode")).toBe(false);
    const changed = new FormData();
    appendProductBarcode(changed, "8806095501239", null);
    expect(changed.get("barcode")).toBe("8806095501239");
    const cleared = new FormData();
    appendProductBarcode(cleared, "", "4780123450017");
    expect(cleared.get("barcode")).toBe("");
  });

  it("409 kod dublikati nom dublikatidan xabar bo'yicha ajratiladi", () => {
    const barcode = { response: { status: 409, data: { message: 'Bu marketda shu shtrix kod "Pepsi" mahsulotiga biriktirilgan' } } };
    const name = { response: { status: 409, data: { message: "Shu nomdagi mahsulot bor" } } };
    expect(isDuplicateBarcodeError(barcode)).toBe(true);
    expect(isDuplicateBarcodeError(name)).toBe(false);
    expect(isDuplicateBarcodeError({ response: { status: 400, data: { message: "shtrix kod noto'g'ri" } } })).toBe(false);
  });
});

describe("QR stiker (taxta tizim-product-labels)", () => {
  it("ELC-P-000123 — V1 (21 modul), Q darajasi", () => {
    const qr = qrPath("ELC-P-000123");
    expect(qr?.size).toBe(21);
    expect(qr?.path.startsWith("M0 0h1v1h-1z")).toBe(true);
  });

  it("40×30: nom, QR, market, «ELC-P-» va raqam alohida; HTML qochiriladi", () => {
    const html = labelHtml({ name: "Kurtka <110 sm>", market: "Baraka & Co", code: "ELC-P-000123" }, "40x30");
    expect(html).toContain("Kurtka &lt;110 sm&gt;");
    expect(html).toContain("Baraka &amp; Co");
    expect(html).toContain(">ELC-P-<");
    expect(html).toContain(">000123<");
    expect(html).toContain(`width:${LABEL_SPECS["40x30"].qr.size}mm`);
  });

  it("hujjat: @page stiker o'lchamida, nusxalar soni 1…500", () => {
    const doc = labelsDocument({ name: "A", market: null, code: "ELC-P-000001" }, "58x40", 3, "Stiker");
    expect(doc).toContain("@page { size: 58mm 40mm; margin: 0; }");
    expect(doc.match(/class="label"/g)).toHaveLength(3);
    expect(labelsDocument({ name: "A", market: null, code: "ELC-P-1" }, "40x30", 0, "x").match(/class="label"/g)).toHaveLength(1);
  });
});
