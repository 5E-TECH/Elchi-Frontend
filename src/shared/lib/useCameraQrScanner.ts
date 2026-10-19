import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import i18n from "../../i18n";
import QrScanner, {
  classifyCameraError,
  type CameraErrorKind,
  type CameraFacing,
  type QrScanRegion,
} from "./qrScanner";

/** Sabab → foydalanuvchiga ko'rinadigan matn (`ui:camera.error.*`); `unknown` — chaqiruvchining `startErrorMessage`. */
const cameraErrorText = (kind: CameraErrorKind, fallback: string) =>
  kind === "unknown" ? fallback : i18n.t(`ui:camera.error.${kind}`, { defaultValue: fallback });

type CameraQrScannerOptions = {
  isActive: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onDecode: (value: string) => void;
  startErrorMessage: string;
  /**
   * Chiroqni yoqib/o'chirib bo'lmadi. Berilsa shu chaqiriladi va kamera xatosi YOZILMAYDI (kamera ishlab
   * turibdi — «Kamera ochilmadi» holati noto'g'ri bo'lardi). Berilmasa — eski xatti-harakat.
   */
  onTorchError?: () => void;
  /**
   * Ochilishda yoqiladigan kamera (Sozlamalar → Skaner → «Asosiy kamera»; sukut — orqa). Faqat sessiya
   * boshida o'qiladi: «Kamerani almashtirish» (`switchCamera`) uni shu ochilish uchun vaqtincha o'zgartiradi.
   */
  preferredCamera?: CameraFacing;
  /** Skan hududi (ekrandagi ramka, `shared/ui/camera/scanRegion`). Berilmasa — kutubxona sukuti. */
  calculateScanRegion?: (video: HTMLVideoElement) => QrScanRegion;
};

export const useCameraQrScanner = ({
  isActive,
  videoRef,
  onDecode,
  startErrorMessage,
  onTorchError,
  preferredCamera = "environment",
  calculateScanRegion,
}: CameraQrScannerOptions) => {
  const scannerRef = useRef<QrScanner | null>(null);
  const onDecodeRef = useRef(onDecode);
  const onTorchErrorRef = useRef(onTorchError);
  const [session, setSession] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraErrorKind, setCameraErrorKind] = useState<CameraErrorKind | null>(null);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const facingRef = useRef<CameraFacing>(preferredCamera);
  const [facing, setFacing] = useState<CameraFacing>(preferredCamera);
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const regionRef = useRef(calculateScanRegion);

  useEffect(() => {
    regionRef.current = calculateScanRegion;
  }, [calculateScanRegion]);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    onTorchErrorRef.current = onTorchError;
  }, [onTorchError]);

  const stopScanner = useCallback(() => {
    const activeScanner = scannerRef.current;
    const video = videoRef.current;

    void activeScanner?.pause(true);
    activeScanner?.stop();
    activeScanner?.destroy();
    scannerRef.current = null;

    if (video) {
      video.pause();
      video.srcObject = null;
      video.load();
    }

    setHasTorch(false);
    setTorchEnabled(false);
    setCanSwitchCamera(false);
  }, [videoRef]);

  const restartScanner = useCallback(() => {
    if (cameraUnavailable) return;
    stopScanner();
    setSession((prev) => prev + 1);
  }, [cameraUnavailable, stopScanner]);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || !hasTorch) return;

    try {
      await scanner.toggleFlash();
      setTorchEnabled(scanner.isFlashOn());
    } catch {
      if (onTorchErrorRef.current) {
        onTorchErrorRef.current();
        return;
      }
      setCameraErrorKind("unknown");
      setCameraError(startErrorMessage);
    }
  }, [hasTorch, startErrorMessage]);

  /**
   * «Kamerani almashtirish»: orqa ↔ old (shu ochilish uchun). Oqim qayta ochiladi; old kamerada odatda chiroq
   * yo'q — chiroq holati qayta tekshiriladi. Almashtirib bo'lmasa — avvalgi kamera bilan qayta ishga tushadi.
   */
  const switchCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const previous = facingRef.current;
    const next: CameraFacing = previous === "environment" ? "user" : "environment";
    facingRef.current = next;
    setFacing(next);
    setTorchEnabled(false);
    try {
      await scanner.setCamera(next);
      if (scannerRef.current !== scanner) return;
      setHasTorch(await scanner.hasFlash().catch(() => false));
    } catch {
      if (scannerRef.current !== scanner) return;
      facingRef.current = previous;
      setFacing(previous);
      stopScanner();
      setSession((prev) => prev + 1);
    }
  }, [stopScanner]);

  useEffect(() => {
    if (!isActive) {
      stopScanner();
      setIsStarting(false);
      return;
    }

    let cancelled = false;
    let restartTimeout: number | null = null;

    const startScanner = async () => {
      setIsStarting(true);
      setCameraError("");
      setCameraErrorKind(null);

      try {
        if (!videoRef.current) {
          throw new Error(startErrorMessage);
        }

        const supportError = await QrScanner.getSupportError();
        if (supportError) {
          setCameraUnavailable(true);
          throw supportError;
        }

        const initialRegion = regionRef.current;
        const scanner = new QrScanner(
          videoRef.current,
          (result: string | { data: string }) => {
            onDecodeRef.current(typeof result === "string" ? result : result.data);
          },
          {
            preferredCamera: facingRef.current,
            ...(initialRegion
              ? { calculateScanRegion: (video: HTMLVideoElement) => (regionRef.current ?? initialRegion)(video) }
              : {}),
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: false,
            onDecodeError: () => undefined,
          },
        );

        scannerRef.current = scanner;
        await scanner.start();

        if (cancelled) {
          scanner.destroy();
          return;
        }

        setCameraUnavailable(false);
        setHasTorch(await scanner.hasFlash().catch(() => false));
        // Bir nechta kamera bo'lsa — «Kamerani almashtirish» tugmasi (soxta skaner testlarda bu usulsiz).
        const cameraCount = await Promise.resolve()
          .then(() => QrScanner.countCameras())
          .catch(() => 0);
        if (!cancelled) setCanSwitchCamera(cameraCount > 1);
      } catch (error) {
        // Bekor qilingan ishga tushirish (StrictMode'ning ikkinchi effekti, `restartScanner`, `isActive` o'chdi):
        // eski skaner yo'q qilingani uchun `start()` rad etadi — bu kamera xatosi EMAS. Aks holda kechikkan rad
        // yangi, ishlab turgan sessiya ustiga «kamera ochilmadi» deb yozib qo'yardi.
        if (cancelled) return;
        const messageText = error instanceof Error ? error.message : String(error);
        const isInterruptedStart =
          messageText.includes("AbortError") ||
          messageText.includes("interrupted by a new load request");

        if (isInterruptedStart && !cancelled) {
          restartTimeout = window.setTimeout(() => {
            setSession((prev) => prev + 1);
          }, 120);
          return;
        }

        // Xom brauzer matni (inglizcha `DOMException`) ekranga chiqmaydi — sababga qarab tarjima qilingan matn.
        const kind = classifyCameraError(error);
        setCameraErrorKind(kind);
        setCameraError(cameraErrorText(kind, startErrorMessage));
      } finally {
        if (!cancelled) {
          setIsStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
      if (restartTimeout) {
        window.clearTimeout(restartTimeout);
      }
    };
  }, [isActive, session, startErrorMessage, stopScanner, videoRef]);

  return {
    isStarting,
    torchEnabled,
    hasTorch,
    cameraError,
    cameraErrorKind,
    cameraUnavailable,
    stopScanner,
    restartScanner,
    toggleTorch,
    setCameraError,
    facing,
    canSwitchCamera,
    switchCamera,
  };
};
