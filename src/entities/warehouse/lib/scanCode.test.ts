import { describe, expect, it } from "vitest";
import { classifyScanCode, isScanCode, normalizeScanCode, splitElchiCode } from "./scanCode";

describe("skaner kodi (ega qarori 11)", () => {
  it.each([
    ["ELC-P-000142", "elchi"],
    ["elc-p-142", "elchi"],
    ["ELC-P000142", "elchi"],
    ["4780123450017", "barcode"],
    ["036000291452", "barcode"],
    ["04963406", "barcode"],
    ["10012345678902", "barcode"],
    ["12345", "text"],
    ["Simsiz quloqchin", "text"],
    ["ELC-X-000142", "text"],
  ] as const)("%s → %s", (raw, kind) => {
    expect(classifyScanCode(raw)).toBe(kind);
    expect(isScanCode(raw)).toBe(kind !== "text");
  });

  it("skaner qo'shadigan boshqaruv belgilari va chetdagi bo'shliq olinadi", () => {
    expect(normalizeScanCode("  ELC-P-000142\r\n")).toBe("ELC-P-000142");
    expect(normalizeScanCode("\u00024780123450017\u0003")).toBe("4780123450017");
  });

  it("Elchi kodi stikerda ikki bo'lak: «ELC-P-» va raqam", () => {
    expect(splitElchiCode("elc-p-000123")).toEqual(["ELC-P-", "000123"]);
    expect(splitElchiCode("4780123450017")).toBeNull();
  });
});
