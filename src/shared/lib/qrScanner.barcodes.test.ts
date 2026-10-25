import { readFileSync } from "node:fs";
import { join } from "node:path";
import BrowserQrScanner from "qr-scanner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SHTRIX KOD REJIMI `qr-scanner` ning YASHIRIN maydoniga tayanadi (`qrScanner.ts` → `installBarcodeEngine`):
 * `_qrEnginePromise` (kadr dvigateli) va `_disableBarcodeDetector` (global bayroq). Bu test HAQIQIY kutubxona bilan:
 * versiya yoki maydon nomlari o'zgarsa — yiqiladi, `installBarcodeEngine` qayta tekshiriladi.
 */

const fakeEngine = { kind: "native" as const, detect: vi.fn(() => Promise.resolve([])) };
const createBarcodeEngine = vi.fn(() => Promise.resolve(fakeEngine));
vi.mock("./scanner/barcodeEngine", () => ({ createBarcodeEngine }));

import QrScanner, { BARCODE_SCANS_PER_SECOND } from "./qrScanner";

type Internals = { _qrEnginePromise: Promise<unknown>; _maxScansPerSecond: number };
type Statics = { _disableBarcodeDetector: boolean };

const internals = (scanner: QrScanner) => (scanner as unknown as { scanner: Internals }).scanner;

describe("qr-scanner yashirin maydonlari — versiya qotirilgan", () => {
  it("qr-scanner 1.4.2: `_qrEnginePromise`, `createQrEngine`, `_disableBarcodeDetector` bor", () => {
    const root = join(process.cwd(), "node_modules/qr-scanner");
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).toBe("1.4.2");
    const source = readFileSync(join(root, "qr-scanner.min.js"), "utf8");
    // Konstruktor dvigatelni shu maydonga yozadi; har kadr shu maydondan o'qiydi; buzilgan native almashtiriladi.
    expect(source).toContain("this._qrEnginePromise=e.createQrEngine()");
    expect(source).toContain("qrEngine:this._qrEnginePromise");
    expect(source).toContain("_disableBarcodeDetector");
    // Worker bo'lmagan dvigatel: `detect(canvas)` → `[0].rawValue` / `cornerPoints`.
    expect(source).toMatch(/\.detect\([a-z]\)/);
    expect(source).toContain(".rawValue");
  });
});

/** jsdom'da `Worker` yo'q — kutubxonaning QR dvigateli (worker) shu soxta bilan yaratiladi. */
const workers: FakeWorker[] = [];
class FakeWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor() {
    workers.push(this);
  }
}

describe("QrScanner: `formats: \"barcodes\"` — dvigatel almashtiriladi (CO66kcoB)", () => {
  let getContext: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal("Worker", FakeWorker);
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:qr-worker");
    getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  });
  afterEach(() => {
    (BrowserQrScanner as unknown as Statics)._disableBarcodeDetector = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  const create = (formats?: "qr" | "barcodes") =>
    new QrScanner(document.createElement("video"), () => undefined, { returnDetailedScanResult: true, formats });

  it("shtrix kod rejimi: kadr dvigateli — bizniki, kutubxona worker'i yopiladi, skan tezligi 10, `willReadFrequently`", async () => {
    const scanner = create("barcodes");
    const inner = internals(scanner);
    await expect(inner._qrEnginePromise).resolves.toBe(fakeEngine);
    await vi.waitFor(() => expect(workers[0]?.terminate).toHaveBeenCalledTimes(1));
    expect(inner._maxScansPerSecond).toBe(BARCODE_SCANS_PER_SECOND);
    expect(getContext).toHaveBeenCalledWith("2d", { alpha: false, willReadFrequently: true });
    scanner.destroy();
    // `destroy()` dagi `close` xabari Worker bo'lmagan dvigatelga yuborilmaydi (xato yo'q).
    await Promise.resolve();
    expect(workers[0].postMessage).not.toHaveBeenCalled();
  });

  it("kutubxona dvigatelni almashtirmoqchi bo'lsa (buzilgan native bayrog'i) — bizniki qoladi, berilgani yopiladi", async () => {
    const scanner = create("barcodes");
    const inner = internals(scanner);
    await inner._qrEnginePromise;
    (BrowserQrScanner as unknown as Statics)._disableBarcodeDetector = true;
    const replacement = new FakeWorker();
    inner._qrEnginePromise = Promise.resolve(replacement);
    await expect(inner._qrEnginePromise).resolves.toBe(fakeEngine);
    await vi.waitFor(() => expect(replacement.terminate).toHaveBeenCalledTimes(1));
    // Bayroq tushirildi — kutubxona har kadrda yangi QR dvigateli yaratmaydi.
    expect((BrowserQrScanner as unknown as Statics)._disableBarcodeDetector).toBe(false);
    scanner.destroy();
  });

  it("dvigatel bo'lagi yuklanmasa — kutubxonaning QR dvigateli bilan davom etadi", async () => {
    createBarcodeEngine.mockImplementationOnce(() => Promise.reject(new Error("chunk")));
    const scanner = create("barcodes");
    const engine = await internals(scanner)._qrEnginePromise;
    expect(engine).toBeInstanceOf(FakeWorker);
    expect((engine as FakeWorker).terminate).not.toHaveBeenCalled();
    scanner.destroy();
  });

  it("QR rejimi (sukut) o'zgarmagan: kutubxona dvigateli, skan tezligi 25, shtrix kod bo'lagi yuklanmaydi", async () => {
    createBarcodeEngine.mockClear();
    for (const scanner of [create(), create("qr")]) {
      const inner = internals(scanner);
      expect(Object.getOwnPropertyDescriptor(inner, "_qrEnginePromise")?.get).toBeUndefined();
      expect(inner._maxScansPerSecond).toBe(25);
      expect(await inner._qrEnginePromise).toBeInstanceOf(FakeWorker);
      scanner.destroy();
    }
    expect(createBarcodeEngine).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
  });
});
