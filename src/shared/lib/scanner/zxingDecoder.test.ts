import QRCode from "qrcode";
import Code128Reader from "@zxing/library/esm/core/oned/Code128Reader";
import { describe, expect, it } from "vitest";
import { code128Modules, ean13Modules, ean8Modules, renderModules, upcAModules } from "../../../test/barcodeFixtures";
import { createZxingDecoder, toLuminance } from "./zxingDecoder";

/** Kamera kadri o'lchami — shtrix kod rejimining tahlil kadri (uzun tomon 640, `scanRegion.ts`). */
const FRAME = { width: 640, height: 344 };
const CODE128_PATTERNS = (Code128Reader as unknown as { CODE_PATTERNS: Int32Array[] }).CODE_PATTERNS;

const decode = (modules: string, moduleWidth = 3) =>
  createZxingDecoder().decode(renderModules(modules, { ...FRAME, moduleWidth }), FRAME.width, FRAME.height);

/** QR (qrcode paketi) → kulrang kadr, modul 6 px, tinch zona bilan markazda. */
const renderQr = (value: string) => {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "Q" });
  const gray = new Uint8ClampedArray(FRAME.width * FRAME.height).fill(230);
  const scale = 6;
  const left = Math.floor((FRAME.width - modules.size * scale) / 2);
  const top = Math.floor((FRAME.height - modules.size * scale) / 2);
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (!modules.get(row, col)) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) gray[(top + row * scale + y) * FRAME.width + left + col * scale + x] = 25;
      }
    }
  }
  return gray;
};

describe("ZXing zaxirasi — zavod shtrix kodlari (CO66kcoB)", () => {
  it.each([
    ["EAN-13", ean13Modules("4780123450017"), "ean_13", "4780123450017"],
    ["EAN-13 (Koreya)", ean13Modules("8806095467894"), "ean_13", "8806095467894"],
    ["EAN-8", ean8Modules("96385074"), "ean_8", "96385074"],
    ["UPC-A", upcAModules("036000291452"), "upc_a", "036000291452"],
    ["Code128", code128Modules("ELC-P-000123", CODE128_PATTERNS), "code_128", "ELC-P-000123"],
  ] as const)("%s o'qiladi", (_label, modules, format, rawValue) => {
    const decoded = decode(modules);
    expect(decoded).toMatchObject({ format, rawValue });
    expect(decoded?.cornerPoints.length).toBeGreaterThan(0);
  });

  it("ingichka chiziqlar (modul 2 px) ham o'qiladi", () => {
    expect(decode(ean13Modules("4780123450017"), 2)?.rawValue).toBe("4780123450017");
  });

  it("nazorat raqami xato EAN-13 / EAN-8 qabul qilinmaydi", () => {
    expect(decode(ean13Modules("4780123450018"))).toBeNull();
    expect(decode(ean8Modules("96385075"))).toBeNull();
  });

  it("QR (Elchi stikeri) ham o'qiladi", () => {
    expect(createZxingDecoder().decode(renderQr("ELC-P-000123"), FRAME.width, FRAME.height)).toMatchObject({
      format: "qr_code",
      rawValue: "ELC-P-000123",
    });
  });

  it("bo'sh kadr — null (xato tashlamaydi)", () => {
    const blank = new Uint8ClampedArray(FRAME.width * FRAME.height).fill(230);
    expect(createZxingDecoder().decode(blank, FRAME.width, FRAME.height)).toBeNull();
  });

  it("RGBA → kulrang: (R + 2G + B) / 4", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 100, 200, 40, 255]);
    expect([...toLuminance(rgba, 3, 1)]).toEqual([255, 0, 135]);
  });
});
