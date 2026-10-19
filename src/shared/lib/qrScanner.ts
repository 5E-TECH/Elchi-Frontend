import BrowserQrScanner from "qr-scanner";

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
}

export default class QrScanner {
  private readonly scanner: BrowserQrScanner;

  constructor(
    video: HTMLVideoElement,
    onDecode: (result: string | ScanResult) => void,
    options?: QrScannerOptions,
  ) {
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
      },
    );
  }

  /** Kamera ishlata olmaslik sababi (`CameraSupportError`, `kind: "unsupported"`) yoki `null`. Matn — faqat jurnal uchun. */
  static async getSupportError(): Promise<CameraSupportError | null> {
    if (typeof window === "undefined") {
      return new CameraSupportError("unsupported", "Scanner is unavailable in this environment.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return new CameraSupportError("unsupported", "Camera access is not available in this browser.");
    }

    const hasCamera = await BrowserQrScanner.hasCamera().catch(() => false);
    if (!hasCamera) {
      return new CameraSupportError("unsupported", "Camera not found on this device.");
    }

    return null;
  }

  async start(): Promise<void> {
    const supportError = await QrScanner.getSupportError();
    if (supportError) {
      throw supportError;
    }

    await this.scanner.start();
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
