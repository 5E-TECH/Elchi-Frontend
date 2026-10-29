import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { encodeReceiptQr, receiptQrModule } from "./printReceiptQr";

/** HJ5sLHiz — QR qoidasi (maket `tizim-receipts` «QR qoidasi», TZ F5): bayt rejimi, H, eng kichik versiya, faqat token. */

const ORDER = "a3f91c07be4d2e58f0c6a1d9"; // 24 hex
const POST = "POST-0123456789abcdef0"; // 22
const BATCH = "BTB-0123456789abcd"; // 18
const CANCEL = "CANCEL-0123456789abcdef0123"; // 27

describe("receipt QR", () => {
  it("picks the smallest version at error correction H: order / POST / BTB → V3 (29), CANCEL → V4 (33)", () => {
    expect(ORDER).toHaveLength(24);
    expect(POST).toHaveLength(22);
    expect(BATCH).toHaveLength(18);
    expect(CANCEL).toHaveLength(27);
    expect(encodeReceiptQr(ORDER)).toMatchObject({ version: 3, count: 29 });
    expect(encodeReceiptQr(POST)).toMatchObject({ version: 3, count: 29 });
    expect(encodeReceiptQr(BATCH)).toMatchObject({ version: 3, count: 29 });
    // 27 bayt H da V3 ga (24) sig'maydi — Q bo'lsa V3 qolardi: versiya xato tuzatish darajasini ham tasdiqlaydi.
    expect(encodeReceiptQr(CANCEL)).toMatchObject({ version: 4, count: 33 });
  });

  it("encodes exactly the token (byte mode, H) — same modules as qrcode itself", () => {
    const symbol = encodeReceiptQr(` ${ORDER} `);
    const reference = QRCode.create([{ data: new TextEncoder().encode(ORDER), mode: "byte" }], {
      errorCorrectionLevel: "H",
    });
    const cells = new Set<string>();
    for (const [row, col, length] of symbol!.runs) {
      for (let i = 0; i < length; i += 1) cells.add(`${row}:${col + i}`);
    }
    const size = reference.modules.size;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        expect(cells.has(`${row}:${col}`), `${row}:${col}`).toBe(
          Boolean(reference.modules.data[row * size + col]),
        );
      }
    }
  });

  it("merges adjacent dark modules of a row into one run", () => {
    const symbol = encodeReceiptQr(ORDER)!;
    // Yuqori chap qidiruv belgisi: birinchi qator 7 modul — bitta bo'lak.
    expect(symbol.runs[0]).toEqual([0, 0, 7]);
    const byRow = new Map<number, number[]>();
    for (const [row, col, length] of symbol.runs) {
      const ends = byRow.get(row) ?? [];
      // Qatordagi bo'laklar bir-biriga tegmaydi (aks holda birlashtirilishi kerak edi).
      expect(ends.includes(col)).toBe(false);
      ends.push(col + length);
      byRow.set(row, ends);
    }
  });

  it("no token → null (the receipt draws a «QR yo'q» frame; the id is never encoded)", () => {
    expect(encodeReceiptQr(null)).toBeNull();
    expect(encodeReceiptQr("  ")).toBeNull();
  });

  it("thermal module is a whole number of 203 DPI dots: 6 dots → 21,75 mm for V3, 5 dots for V4", () => {
    expect(receiptQrModule(29, 21.75, [6, 5, 4])).toBeCloseTo(0.75, 6);
    expect(receiptQrModule(29, 21.75, [6, 5, 4]) * 29).toBeCloseTo(21.75, 6);
    expect(receiptQrModule(33, 21.75, [6, 5, 4])).toBeCloseTo(0.625, 6);
    expect(receiptQrModule(37, 21.75, [6, 5, 4])).toBeCloseTo(0.5, 6);
    // Ofis printeri (A4 / A5): quti modul soniga bo'linadi.
    expect(receiptQrModule(29, 20)).toBeCloseTo(20 / 29, 6);
  });
});
