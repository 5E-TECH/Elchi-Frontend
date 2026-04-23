type BarcodeDetectorClass = {
  new (options?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorClass;
  }
}

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

type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};

export default class QrScanner {
  private readonly video: HTMLVideoElement;
  private readonly onDecode: (result: string | ScanResult) => void;
  private readonly options?: QrScannerOptions;
  private stream: MediaStream | null = null;
  private detector: InstanceType<BarcodeDetectorClass> | null = null;
  private animationFrameId: number | null = null;
  private paused = false;
  private flashEnabled = false;

  constructor(
    video: HTMLVideoElement,
    onDecode: (result: string | ScanResult) => void,
    options?: QrScannerOptions,
  ) {
    this.video = video;
    this.onDecode = onDecode;
    this.options = options;
  }

  async start(): Promise<void> {
    const BarcodeDetectorApi = window.BarcodeDetector;

    if (!BarcodeDetectorApi) {
      throw new Error("BarcodeDetector API is not supported in this browser.");
    }

    this.detector = new BarcodeDetectorApi({ formats: ["qr_code"] });
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: this.options?.preferredCamera === "environment"
          ? { ideal: "environment" }
          : undefined,
      },
      audio: false,
    });

    this.video.srcObject = this.stream;
    this.video.setAttribute("playsinline", "true");
    this.video.muted = true;
    await this.video.play();
    this.paused = false;
    this.scanLoop();
  }

  stop(): void {
    this.paused = true;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  pause(stopStream?: boolean): void {
    this.paused = true;
    if (stopStream) {
      this.stop();
      return;
    }
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.video.pause();
  }

  destroy(): void {
    this.stop();
    this.video.srcObject = null;
    this.detector = null;
  }

  async hasFlash(): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return false;
    const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined;
    return Boolean(capabilities?.torch);
  }

  async toggleFlash(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined;
    if (!capabilities?.torch) return;

    this.flashEnabled = !this.flashEnabled;
    await track.applyConstraints({
      advanced: [{ torch: this.flashEnabled } as MediaTrackConstraintSet],
    });
  }

  isFlashOn(): boolean {
    return this.flashEnabled;
  }

  private scanLoop = async () => {
    if (this.paused || !this.detector) return;

    try {
      if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const results = await this.detector.detect(this.video);
        const first = results[0];
        if (first?.rawValue) {
          if (this.options?.returnDetailedScanResult) {
            this.onDecode({ data: first.rawValue });
          } else {
            this.onDecode(first.rawValue);
          }
        }
      }
    } catch (error) {
      this.options?.onDecodeError?.(error);
    } finally {
      if (!this.paused) {
        this.animationFrameId = window.requestAnimationFrame(this.scanLoop);
      }
    }
  };
}
