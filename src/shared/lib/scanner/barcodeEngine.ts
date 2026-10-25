import { acceptDecodedCode, BARCODE_FORMATS } from "./barcodeCodes";
import type { DecodedCode } from "./zxingDecoder";

/**
 * SHTRIX KOD DEKODERI (Trello CO66kcoB) — kamera «shtrix kod» rejimida (`ScanTarget.formats: "barcodes"`) kadrni
 * o'qiydigan dvigatel. `qr-scanner` uni o'zining QR dvigateli o'rnida chaqiradi (`qrScanner.ts`):
 * `detect(canvas)` → `[{ rawValue, cornerPoints }]` yoki `[]`; canvas — ramka hududi chizilgan kadr.
 *
 *   - `BarcodeDetector` bor va QR, EAN-13, EAN-8, UPC-A, Code128 ning HAMMASINI qo'llasa — native (Android Chrome,
 *     macOS / ChromeOS Chrome): tez, asosiy oqimni band qilmaydi;
 *   - aks holda — ZXing (`zxingDecoder.ts`, alohida bo'lak, faqat shu holda yuklanadi): iOS Safari, Firefox,
 *     Windows / Linux Chrome. Native dekoder ishlab turib buzilsa (`not implemented`, `service unavailable` —
 *     masalan Google xizmatlarisiz Android) — shu kameraning qolgan vaqti ZXing.
 *
 * Har natija `acceptDecodedCode` dan o'tadi: EAN/UPC nazorat raqami xato bo'lsa kod qabul qilinmaydi.
 * `detect` hech qachon xato tashlamaydi: `qr-scanner` native dvigatel xatosida global «BarcodeDetector o'chiq»
 * bayrog'ini yoqadi — boshqa (QR) skanerlarga ta'sir qilmasin.
 */

export type BarcodeEngine = {
  /** `native` — `BarcodeDetector`, `zxing` — JS zaxira. */
  kind: "native" | "zxing";
  detect: (canvas: HTMLCanvasElement) => Promise<DecodedCode[]>;
};

type NativeResult = { format: string; rawValue: string; cornerPoints?: { x: number; y: number }[] };
type NativeDetector = { detect: (source: HTMLCanvasElement) => Promise<NativeResult[]> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

type UserAgentData = {
  brands: { brand: string }[];
  platform: string;
  getHighEntropyValues: (hints: string[]) => Promise<{ architecture?: string; platformVersion?: string }>;
};

const nativeDetectorClass = (): NativeDetectorClass | null => {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  return typeof Detector === "function" && typeof Detector.getSupportedFormats === "function" ? Detector : null;
};

/**
 * Chromium + macOS 13+ + ARM (M1/M2): `BarcodeDetector` xato bermaydi, lekin QR'ni topmaydi (`qr-scanner` ham shu
 * holatda native'dan voz kechadi, issue #209). Ma'lumot berilmasa — buzilgan deb olinadi (xavfsiz tomoni).
 */
const isBrokenMacDetector = async (): Promise<boolean> => {
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (!data || !data.brands.some(({ brand }) => /Chromium/i.test(brand)) || !/mac ?OS/i.test(data.platform)) return false;
  try {
    const { architecture, platformVersion } = await data.getHighEntropyValues(["architecture", "platformVersion"]);
    return /arm/i.test(architecture || "arm") && Number.parseInt(platformVersion || "13", 10) >= 13;
  } catch {
    return true;
  }
};

/** Native dekoder barcha kerakli formatlarni qo'llaydimi (aks holda ZXing). */
export const findNativeBarcodeDetector = async (): Promise<NativeDetectorClass | null> => {
  const Detector = nativeDetectorClass();
  if (!Detector) return null;
  try {
    const supported = await Detector.getSupportedFormats();
    if (!BARCODE_FORMATS.every((format) => supported.includes(format))) return null;
  } catch {
    return null;
  }
  return (await isBrokenMacDetector()) ? null : Detector;
};

const NO_CODES: DecodedCode[] = [];
const EMPTY_ENGINE: BarcodeEngine = { kind: "zxing", detect: () => Promise.resolve(NO_CODES) };

const createZxingEngine = async (): Promise<BarcodeEngine> => {
  const { createZxingDecoder, toLuminance } = await import("./zxingDecoder");
  const decoder = createZxingDecoder();
  return {
    kind: "zxing",
    detect: async (canvas) => {
      try {
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) return NO_CODES;
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = decoder.decode(toLuminance(data, width, height), width, height);
        return decoded ? [decoded] : NO_CODES;
      } catch {
        return NO_CODES;
      }
    },
  };
};

const createNativeEngine = (Detector: NativeDetectorClass): BarcodeEngine => {
  const detector = new Detector({ formats: [...BARCODE_FORMATS] });
  let fallback: Promise<BarcodeEngine> | null = null;
  return {
    kind: "native",
    detect: async (canvas) => {
      if (fallback) return (await fallback).detect(canvas);
      try {
        const results = (await detector.detect(canvas)).filter((result) => acceptDecodedCode(result.format, result.rawValue));
        // Qutida QR (sayt havolasi) va zavod kodi yonma-yon bo'lsa — zavod kodi (ZXing ham 1D ni birinchi o'qiydi).
        const accepted = results.find((result) => result.format !== "qr_code") ?? results[0];
        return accepted
          ? [{ format: accepted.format as DecodedCode["format"], rawValue: accepted.rawValue, cornerPoints: accepted.cornerPoints ?? [] }]
          : NO_CODES;
      } catch {
        // Native dekoder buzildi — shu kameraning qolgan vaqti ZXing (bo'lak yuklanmasa — jim, kamera ochiq qoladi).
        fallback = createZxingEngine().catch(() => EMPTY_ENGINE);
        return NO_CODES;
      }
    },
  };
};

/** Dvigatel: native (bor bo'lsa va formatlarni qo'llasa) yoki ZXing. */
export const createBarcodeEngine = async (): Promise<BarcodeEngine> => {
  const Detector = await findNativeBarcodeDetector();
  return Detector ? createNativeEngine(Detector) : createZxingEngine();
};
