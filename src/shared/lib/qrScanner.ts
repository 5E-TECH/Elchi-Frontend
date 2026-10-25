import BrowserQrScanner from "qr-scanner";
import type { ScanFormats } from "./scanner/barcodeCodes";

export interface ScanResult {
  data: string;
}

/**
 * Kamera ishga tushmasligi sababi (ekranga xom brauzer matni CHIQMAYDI — `ui:camera.error.<kind>`):
 *   - `denied` — foydalanuvchi yoki brauzer ruxsat bermadi (`NotAllowedError`, `SecurityError`);
 *   - `busy` — kamera boshqa ilovada ochiq (`NotReadableError`, `AbortError` emas);
 *   - `unsupported` — brauzerda kamera API'si yo'q yoki qurilmada kamera topilmadi;
 *   - `unknown` — boshqa xato.
 */
export type CameraErrorKind = "denied" | "busy" | "unsupported" | "unknown";

/** Qo'llab-quvvatlash xatosi (kamera API'si yoki qurilmada kamera yo'q) — `kind` bilan. */
export class CameraSupportError extends Error {
  readonly kind: CameraErrorKind;

  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.name = "CameraSupportError";
    this.kind = kind;
  }
}

const DENIED_NAMES = new Set(["NotAllowedError", "PermissionDeniedError", "SecurityError"]);
const BUSY_NAMES = new Set(["NotReadableError", "TrackStartError"]);
const MISSING_NAMES = new Set(["NotFoundError", "DevicesNotFoundError", "OverconstrainedError", "ConstraintNotSatisfiedError"]);

/** Brauzer / `qr-scanner` xatosini sababga aylantiradi (`DOMException.name` yoki kutubxona matni). */
export const classifyCameraError = (error: unknown): CameraErrorKind => {
  if (error instanceof CameraSupportError) return error.kind;
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (DENIED_NAMES.has(name)) return "denied";
  if (BUSY_NAMES.has(name)) return "busy";
  if (MISSING_NAMES.has(name)) return "unsupported";
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/permission|not allowed|denied/i.test(text)) return "denied";
  if (/could not start video source|not readable|in use/i.test(text)) return "busy";
  if (/camera not found|no camera|not available/i.test(text)) return "unsupported";
  return "unknown";
};

/** `qr-scanner` ning umumiy xatosi (satr): u har `getUserMedia` rad etilishini (sababi bilan) shunga almashtiradi. */
const isLibraryCameraError = (error: unknown) => typeof error === "string" && /^camera not found\.?$/i.test(error.trim());

/**
 * Haqiqiy sabab (kkDkrAIz). Kutubxona `NotAllowedError` / `NotReadableError` / `NotFoundError` ni yutib, hammasini
 * bitta satrga aylantiradi — «Kamera band» holati hech chiqmasdi, ishga tushishda rad etilgan ruxsat esa «kamera
 * qo'llab-quvvatlanmaydi» bo'lib ko'rinardi. Shu satr kelsa — bitta oddiy `getUserMedia` (kutubxona o'zi 6 marta
 * so'raydi): rad etilsa — brauzerning `DOMException` i (nomi bilan) qaytadi, muvaffaqiyatli bo'lsa (masalan faqat
 * kutubxona cheklovlari mos kelmadi) — oqim darhol yopiladi va asl xato qoladi.
 */
export const revealCameraStartError = async (error: unknown): Promise<unknown> => {
  if (!isLibraryCameraError(error) || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return error;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((track) => track.stop());
    return error;
  } catch (cause) {
    return cause;
  }
};

export type CameraFacing = "environment" | "user";

export type QrScanRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  downScaledWidth: number;
  downScaledHeight: number;
};

interface QrScannerOptions {
  preferredCamera?: string;
  /** Faqat shu hudud o'qiladi (ekrandagi ramka) — berilmasa kutubxona sukuti. */
  calculateScanRegion?: (video: HTMLVideoElement) => QrScanRegion;
  returnDetailedScanResult?: boolean;
  highlightScanRegion?: boolean;
  highlightCodeOutline?: boolean;
  onDecodeError?: (error: unknown) => void;
  /** `barcodes` — QR + zavod shtrix kodlari (`scanner/barcodeEngine.ts`); sukut `qr` — kutubxonaning QR dvigateli. */
  formats?: ScanFormats;
}

/**
 * Shtrix kod rejimida sekundiga skanlar (QR rejimi — kutubxona sukuti 25): ZXing kadrni asosiy oqimda o'qiydi
 * (kod yo'q kadr ~10 ms, telefonda 2–4 barobar ko'p) — 10 marta yetarli va interfeys qotmaydi.
 */
export const BARCODE_SCANS_PER_SECOND = 10;

type EngineInternals = { _qrEnginePromise?: Promise<unknown> };
type ScannerStatics = { _disableBarcodeDetector?: boolean };

const terminateWorker = (engine: unknown) => {
  if (typeof Worker !== "undefined" && engine instanceof Worker) engine.terminate();
};

/**
 * SHTRIX KOD DVIGATELI (Trello CO66kcoB). `qr-scanner` (1.4.2) kamerani boshqaradi (oqim, chiroq, kamera
 * almashtirish, skan hududi, skan tezligi), lekin faqat QR o'qiydi va dvigatelni tashqaridan berish usuli yo'q.
 * Kutubxona har kadrda `scanImage(video, { qrEngine: this._qrEnginePromise, … })` ni chaqiradi; dvigatel `Worker`
 * bo'lmasa — oddiy `await qrEngine.detect(canvas)` va `[0].rawValue` / `cornerPoints` ni oladi. Shuning uchun
 * YASHIRIN `_qrEnginePromise` maydoni bizning dvigatel bilan almashtiriladi (yagona yo'l; kamera kodi takrorlanmaydi):
 *
 *   - maydon getter/setter bilan qotiriladi: kutubxona native dvigatel buzilganda (global
 *     `_disableBarcodeDetector`) uni har kadrda QR dvigateliga almashtiradi — shtrix kod o'qilmay qolardi. Setter
 *     berilgan dvigatelni yopadi va bayroqni tushiradi (aks holda har kadrda yangi worker yaratilardi);
 *   - kutubxona konstruktorda yaratgan QR dvigateli (worker) bizniki tayyor bo'lgach yopiladi; `destroy()` dagi
 *     `close` xabari `Worker` bo'lmagan dvigatelga yuborilmaydi (kutubxona o'zi tekshiradi);
 *   - bizning bo'lak yuklanmasa (oflayn) — QR dvigateli bilan davom etadi (kamera ishlaydi, faqat QR).
 *
 * Kutubxona versiyasi yoki maydon nomlari o'zgarsa — `qrScanner.barcodes.test.ts` yiqiladi.
 */
const installBarcodeEngine = (scanner: BrowserQrScanner) => {
  const internals = scanner as unknown as EngineInternals;
  const original = internals._qrEnginePromise;
  if (!original) return;
  // Kutubxona dvigateli (worker) yaratilmasa — jim (bizniki ishlaydi); rad etilgan va'da konsolga chiqmasin.
  original.catch(() => undefined);
  const engine: Promise<unknown> = import("./scanner/barcodeEngine")
    .then(({ createBarcodeEngine }) => createBarcodeEngine())
    .then(
      (created) => {
        void original.then(terminateWorker, () => undefined);
        return created;
      },
      () => original,
    );
  Object.defineProperty(scanner, "_qrEnginePromise", {
    configurable: true,
    enumerable: true,
    get: () => engine,
    set: (replacement: unknown) => {
      void Promise.resolve(replacement).then(terminateWorker, () => undefined);
      (BrowserQrScanner as unknown as ScannerStatics)._disableBarcodeDetector = false;
    },
  });
  // ZXing kadrni har skanda `getImageData` bilan o'qiydi: kontekst shu bayroq bilan birinchi yaratilsa — tezroq
  // (kutubxonaning keyingi `getContext("2d", { alpha: false })` chaqiruvi shu kontekstni qaytaradi).
  scanner.$canvas.getContext("2d", { alpha: false, willReadFrequently: true });
};

export default class QrScanner {
  private readonly scanner: BrowserQrScanner;
  private readonly video: HTMLVideoElement;

  constructor(
    video: HTMLVideoElement,
    onDecode: (result: string | ScanResult) => void,
    options?: QrScannerOptions,
  ) {
    this.video = video;
    const barcodes = options?.formats === "barcodes";
    this.scanner = new BrowserQrScanner(
      video,
      (result) => {
        if (options?.returnDetailedScanResult) {
          onDecode({ data: result.data });
          return;
        }

        onDecode(result.data);
      },
      {
        preferredCamera: options?.preferredCamera === "user" ? "user" : "environment",
        returnDetailedScanResult: true,
        highlightScanRegion: options?.highlightScanRegion,
        ...(options?.calculateScanRegion ? { calculateScanRegion: options.calculateScanRegion } : {}),
        highlightCodeOutline: options?.highlightCodeOutline,
        onDecodeError: options?.onDecodeError as ((error: Error | string) => void) | undefined,
        ...(barcodes ? { maxScansPerSecond: BARCODE_SCANS_PER_SECOND } : {}),
      },
    );
    if (barcodes) installBarcodeEngine(this.scanner);
  }

  /**
   * Kamera ishlata olmaslik sababi (`CameraSupportError`, `kind: "unsupported"`) yoki `null`. Matn — faqat jurnal
   * uchun (ekranga `ui:camera.*` tarjimasi chiqadi); inglizcha yozilmaydi — kkDkrAIz regressiya tekshiruvi.
   */
  static async getSupportError(): Promise<CameraSupportError | null> {
    if (typeof window === "undefined") {
      return new CameraSupportError("unsupported", "Skaner bu muhitda ishlamaydi (window yo'q).");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return new CameraSupportError("unsupported", "Brauzerda kamera API'si (getUserMedia) yo'q.");
    }

    const hasCamera = await BrowserQrScanner.hasCamera().catch(() => false);
    if (!hasCamera) {
      return new CameraSupportError("unsupported", "Qurilmada kamera topilmadi.");
    }

    return null;
  }

  async start(): Promise<void> {
    const supportError = await QrScanner.getSupportError();
    if (supportError) {
      throw supportError;
    }

    try {
      await this.scanner.start();
    } catch (error) {
      throw await revealCameraStartError(error);
    }
  }

  stop(): void {
    this.scanner.stop();
  }

  pause(stopStream?: boolean): Promise<boolean> {
    return this.scanner.pause(stopStream);
  }

  destroy(): void {
    this.scanner.destroy();
  }

  /** Qurilmadagi kameralar soni (yorliqlarsiz — ruxsat so'ralmaydi). Xatoda 0. */
  static async countCameras(): Promise<number> {
    try {
      return (await BrowserQrScanner.listCameras(false)).length;
    } catch {
      return 0;
    }
  }

  /** Kamerani almashtirish (oqim qayta ochiladi, ko'zgu va skan hududi yangilanadi). */
  setCamera(facing: CameraFacing): Promise<void> {
    return this.scanner.setCamera(facing);
  }

  /**
   * Skan hududini qayta hisoblash (`calculateScanRegion`). Kutubxona uni faqat `play` / `loadedmetadata` da
   * hisoblaydi, o'lcham o'zgarishida (`resize`) — yo'q: planshet burilsa, oyna kattalashsa yoki brauzer paneli
   * yashirilsa eski piksel to'rtburchagi qolib ketardi. Kutubxonaning o'z `loadedmetadata` ishlovchisi hududni
   * va ustki qatlamni yangilaydi (oqim to'xtamaydi).
   */
  updateScanRegion(): void {
    this.video.dispatchEvent(new Event("loadedmetadata"));
  }

  hasFlash(): Promise<boolean> {
    return this.scanner.hasFlash();
  }

  toggleFlash(): Promise<void> {
    return this.scanner.toggleFlash();
  }

  isFlashOn(): boolean {
    return this.scanner.isFlashOn();
  }
}
