import { afterEach, describe, expect, it, vi } from "vitest";
import { ean13Modules, renderModules } from "../../../test/barcodeFixtures";
import { createBarcodeEngine, findNativeBarcodeDetector } from "./barcodeEngine";

const ALL_FORMATS = ["qr_code", "ean_13", "ean_8", "upc_a", "code_128", "upc_e", "data_matrix"];

type NativeResult = { format: string; rawValue: string; cornerPoints?: { x: number; y: number }[] };

const installDetector = ({
  formats = ALL_FORMATS,
  detect = () => Promise.resolve([] as NativeResult[]),
}: {
  formats?: string[];
  detect?: () => Promise<NativeResult[]>;
} = {}) => {
  const created: { formats: string[] }[] = [];
  class FakeBarcodeDetector {
    static getSupportedFormats = () => Promise.resolve(formats);
    constructor(options: { formats: string[] }) {
      created.push(options);
    }
    detect = detect;
  }
  vi.stubGlobal("BarcodeDetector", FakeBarcodeDetector);
  return created;
};

/** jsdom'da canvas chizilmaydi — `getImageData` tayyor kadrni (RGBA) qaytaradigan soxta canvas. */
const fakeCanvas = (gray: Uint8ClampedArray, width: number, height: number) => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  gray.forEach((value, index) => rgba.set([value, value, value, 255], index * 4));
  return {
    width,
    height,
    getContext: () => ({ getImageData: () => ({ data: rgba, width, height }) }),
  } as unknown as HTMLCanvasElement;
};

const ean13Canvas = (code: string) =>
  fakeCanvas(renderModules(ean13Modules(code), { width: 640, height: 344, moduleWidth: 3 }), 640, 344);

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "userAgentData");
});

describe("shtrix kod dvigateli: native yoki ZXing (CO66kcoB)", () => {
  it("BarcodeDetector barcha formatlarni qo'llaydi — native, aynan 5 format bilan", async () => {
    const created = installDetector();
    const engine = await createBarcodeEngine();
    expect(engine.kind).toBe("native");
    expect(created).toEqual([{ formats: ["qr_code", "ean_13", "ean_8", "upc_a", "code_128"] }]);
  });

  it("biror format yetishmasa (masalan faqat QR) — ZXing", async () => {
    installDetector({ formats: ["qr_code", "ean_13"] });
    expect(await findNativeBarcodeDetector()).toBeNull();
    expect((await createBarcodeEngine()).kind).toBe("zxing");
  });

  it("BarcodeDetector yo'q — ZXing, kadrdagi EAN-13 o'qiladi", async () => {
    const engine = await createBarcodeEngine();
    expect(engine.kind).toBe("zxing");
    const [code] = await engine.detect(ean13Canvas("4780123450017"));
    expect(code).toMatchObject({ format: "ean_13", rawValue: "4780123450017" });
  });

  it("ZXing: nazorat raqami xato kod — topilmadi", async () => {
    const engine = await createBarcodeEngine();
    expect(await engine.detect(ean13Canvas("4780123450018"))).toEqual([]);
  });

  it("Chromium + macOS 13 + ARM (native QR buzilgan) — ZXing", async () => {
    installDetector();
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: {
        brands: [{ brand: "Chromium" }],
        platform: "macOS",
        getHighEntropyValues: () => Promise.resolve({ architecture: "arm", platformVersion: "14.1.0" }),
      },
    });
    expect((await createBarcodeEngine()).kind).toBe("zxing");
  });

  it("native: nazorat raqami xato natija tashlanadi, QR yonida zavod kodi ustun", async () => {
    installDetector({
      detect: () =>
        Promise.resolve([
          { format: "qr_code", rawValue: "https://example.uz", cornerPoints: [] },
          { format: "ean_13", rawValue: "4780123450018", cornerPoints: [] },
          { format: "ean_13", rawValue: "4780123450017", cornerPoints: [{ x: 1, y: 2 }] },
        ]),
    });
    const engine = await createBarcodeEngine();
    expect(await engine.detect(document.createElement("canvas"))).toEqual([
      { format: "ean_13", rawValue: "4780123450017", cornerPoints: [{ x: 1, y: 2 }] },
    ]);
  });

  it("native buzilsa (`service unavailable`) — xato tashlamaydi, keyingi kadrlar ZXing", async () => {
    const detect = vi.fn(() => Promise.reject(new DOMException("Barcode detection service unavailable.", "NotSupportedError")));
    installDetector({ detect });
    const engine = await createBarcodeEngine();
    expect(await engine.detect(ean13Canvas("4780123450017"))).toEqual([]);
    const [code] = await engine.detect(ean13Canvas("4780123450017"));
    expect(code).toMatchObject({ format: "ean_13", rawValue: "4780123450017" });
    expect(detect).toHaveBeenCalledTimes(1);
  });
});
