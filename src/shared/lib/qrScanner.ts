import BrowserQrScanner from "qr-scanner";

export interface ScanResult {
  data: string;
}

interface QrScannerOptions {
  preferredCamera?: string;
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
        highlightCodeOutline: options?.highlightCodeOutline,
        onDecodeError: options?.onDecodeError as ((error: Error | string) => void) | undefined,
      },
    );
  }

  static async getSupportError(): Promise<string | null> {
    if (typeof window === "undefined") {
      return "Scanner is unavailable in this environment.";
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return "Camera access is not available in this browser.";
    }

    const hasCamera = await BrowserQrScanner.hasCamera().catch(() => false);
    if (!hasCamera) {
      return "Camera not found on this device.";
    }

    return null;
  }

  async start(): Promise<void> {
    const supportError = await QrScanner.getSupportError();
    if (supportError) {
      throw new Error(supportError);
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
