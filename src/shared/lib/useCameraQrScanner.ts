import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import QrScanner from "./qrScanner";

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

      try {
        if (!videoRef.current) {
          throw new Error(startErrorMessage);
        }

        const supportError = await QrScanner.getSupportError();
        if (supportError) {
          setCameraUnavailable(true);
          throw new Error(supportError);
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

        setCameraError(messageText || startErrorMessage);
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
    cameraUnavailable,
    stopScanner,
    restartScanner,
    toggleTorch,
    setCameraError,
  };
};
