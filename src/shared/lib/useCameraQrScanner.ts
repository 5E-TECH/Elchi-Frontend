import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import i18n from "../../i18n";
import QrScanner, { classifyCameraError, type CameraErrorKind } from "./qrScanner";

/** Sabab → foydalanuvchiga ko'rinadigan matn (`ui:camera.error.*`); `unknown` — chaqiruvchining `startErrorMessage`. */
const cameraErrorText = (kind: CameraErrorKind, fallback: string) =>
  kind === "unknown" ? fallback : i18n.t(`ui:camera.error.${kind}`, { defaultValue: fallback });

type CameraQrScannerOptions = {
  isActive: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onDecode: (value: string) => void;
  startErrorMessage: string;
};

export const useCameraQrScanner = ({
  isActive,
  videoRef,
  onDecode,
  startErrorMessage,
}: CameraQrScannerOptions) => {
  const scannerRef = useRef<QrScanner | null>(null);
  const onDecodeRef = useRef(onDecode);
  const [session, setSession] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraErrorKind, setCameraErrorKind] = useState<CameraErrorKind | null>(null);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

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
      setCameraErrorKind("unknown");
      setCameraError(startErrorMessage);
    }
  }, [hasTorch, startErrorMessage]);

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

        const scanner = new QrScanner(
          videoRef.current,
          (result: string | { data: string }) => {
            onDecodeRef.current(typeof result === "string" ? result : result.data);
          },
          {
            preferredCamera: "environment",
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
  };
};
