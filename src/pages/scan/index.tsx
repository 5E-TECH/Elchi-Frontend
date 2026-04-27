import { useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  QrCode,
  RefreshCw,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import QrScanner from "../../shared/lib/qrScanner";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import {
  extractScannerToken,
  playScanFeedback,
} from "./lib/scanShared";
import {
  fetchScanDetail,
  getScanDetailQueryKey,
} from "./lib/scanResource";

const ScanPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const stopScannerRef = useRef<() => void>(() => undefined);
  const nextAllowedScanAtRef = useRef(0);
  const redirectTimeoutRef = useRef<number | null>(null);

  const [scannerSession, setScannerSession] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [scannedId, setScannedId] = useState("");
  const [scanState, setScanState] = useState<"idle" | "success" | "invalid">("idle");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

  const handleDecodedValue = useCallback((rawValue: string) => {
    if (Date.now() < nextAllowedScanAtRef.current) return true;

    const nextToken = extractScannerToken(rawValue, window.location.origin);

    if (nextToken) {
      stopScannerRef.current();
      setError("");
      setScanState("success");
      setScanResult(nextToken);
      setScannedId(nextToken);
      void playScanFeedback("success");
      void queryClient.prefetchQuery({
        queryKey: getScanDetailQueryKey(nextToken),
        queryFn: () => fetchScanDetail(nextToken),
      });
      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate(`/scan/${encodeURIComponent(nextToken)}`);
      }, 180);
      return true;
    }

    setScanState("invalid");
    setScanResult(rawValue);
    setError(t("scannerInvalidQr"));
    void playScanFeedback("error");
    nextAllowedScanAtRef.current = Date.now() + 1800;
    return true;
  }, [navigate, queryClient, t]);

  useKeyboardScanner({
    enabled: true,
    captureEditableTargets: true,
    onScan: handleDecodedValue,
  });

  useEffect(() => {
    let cancelled = false;
    let restartTimeout: number | null = null;

    const stopScanner = () => {
      const video = videoRef.current;
      const activeScanner = scannerRef.current;
      void activeScanner?.pause(true);
      activeScanner?.stop();
      activeScanner?.destroy();
      scannerRef.current = null;
      if (video) {
        video.pause();
        video.srcObject = null;
        video.load();
      }
      setTorchEnabled(false);
      setHasTorch(false);
    };

    stopScannerRef.current = stopScanner;

    const startScanner = async () => {
      setIsStarting(true);
      setError("");
      setScanResult("");
      setScannedId("");
      setScanState("idle");
      nextAllowedScanAtRef.current = 0;

      try {
        if (!videoRef.current) {
          throw new Error(t("scannerStartError"));
        }

        const supportError = await QrScanner.getSupportError();
        if (supportError) {
          setCameraUnavailable(true);
          throw new Error(supportError);
        }

        const scanner = new QrScanner(
          videoRef.current,
          (result: string | { data: string }) => {
            const rawValue = typeof result === "string" ? result : result.data;
            handleDecodedValue(rawValue);
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
        setCameraUnavailable(false);

        if (cancelled) {
          scanner.destroy();
          return;
        }

        setHasTorch(await scanner.hasFlash().catch(() => false));
      } catch (scannerError) {
        const messageText =
          scannerError instanceof Error || typeof scannerError === "string"
            ? String(scannerError)
            : t("scannerStartError");

        const isInterruptedStart =
          messageText.includes("AbortError") ||
          messageText.includes("interrupted by a new load request");

        if (isInterruptedStart && !cancelled) {
          restartTimeout = window.setTimeout(() => {
            setScannerSession((prev) => prev + 1);
          }, 120);
          return;
        }

        const message =
          messageText;
        setError(message);
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
        restartTimeout = null;
      }
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [handleDecodedValue, navigate, queryClient, scannerSession, t]);

  const handleToggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !hasTorch) return;

    try {
      await scanner.toggleFlash();
      setTorchEnabled(scanner.isFlashOn());
    } catch {
      setError(t("scannerTorchError"));
    }
  };

  const handleRestart = () => {
    if (cameraUnavailable) return;
    stopScannerRef.current();
    setScannerSession((prev) => prev + 1);
  };

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_92%,var(--color-main)_8%)_0%,color-mix(in_srgb,var(--color-sidebar)_86%,var(--color-main)_14%)_100%)] shadow-sm dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-maindark)_92%,var(--color-main)_8%)_0%,color-mix(in_srgb,var(--color-primarydark)_88%,var(--color-maindark)_12%)_100%)]">
      <style>{`
        @keyframes scan-line-y {
          0% {
            top: 14%;
            opacity: 0.45;
          }
          50% {
            top: 50%;
            opacity: 1;
          }
          100% {
            top: 86%;
            opacity: 0.45;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-main)_16%,transparent),transparent_34%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--color-main)_10%,transparent),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-main)_20%,transparent),transparent_34%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--color-success)_10%,transparent),transparent_28%)]" />

      <div className="relative flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-white text-[color:var(--color-text-muted)] transition hover:border-main/30 hover:bg-main/5 hover:text-main dark:bg-maindark dark:text-white/80 dark:hover:bg-white/12 dark:hover:text-white"
            aria-label={t("back")}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-main/10 text-main ring-1 ring-main/10 dark:bg-white/10 dark:text-white dark:ring-white/10">
            <QrCode size={20} />
          </div>
          <div>
            <p className="m-0 text-lg font-extrabold tracking-tight text-maindark dark:text-white">
              {t("scannerTitle")}
            </p>
            <p className="m-0 mt-0.5 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerSubtitle")}
            </p>
          </div>
        </div>

        {hasTorch ? (
          <button
            type="button"
            onClick={() => void handleToggleTorch()}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-white text-[color:var(--color-text-muted)] transition hover:border-main/30 hover:bg-main/5 hover:text-main dark:bg-maindark dark:text-white/80 dark:hover:bg-white/12 dark:hover:text-white"
            aria-label={t("scannerTorch")}
          >
            {torchEnabled ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
          </button>
        ) : null}
      </div>

      <div className="relative grid gap-6 px-5 py-5 md:grid-cols-[1.12fr_0.88fr] md:px-7 md:py-7">
        <div className="relative overflow-hidden rounded-[30px] border border-[color:var(--color-border-soft)] bg-maindark shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-main)_10%,transparent),rgba(15,23,42,0.22))]" />

          <div className="relative aspect-[4/5] w-full md:aspect-[16/10]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover opacity-95"
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[58%] w-[68%] max-w-[340px] rounded-[34px] border border-white/10 bg-white/[0.04] shadow-[0_0_0_9999px_rgba(7,10,24,0.34)]">
                <div className="absolute left-0 top-0 h-12 w-12 rounded-tl-[30px] border-l-4 border-t-4 border-[#7c8cff]" />
                <div className="absolute right-0 top-0 h-12 w-12 rounded-tr-[30px] border-r-4 border-t-4 border-[#7c8cff]" />
                <div className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-[30px] border-b-4 border-l-4 border-[#7c8cff]" />
                <div className="absolute bottom-0 right-0 h-12 w-12 rounded-br-[30px] border-b-4 border-r-4 border-[#7c8cff]" />
                <div
                  className="absolute left-[8%] right-[8%] h-[2px] -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(124,140,255,0.98),transparent)] shadow-[0_0_24px_rgba(124,140,255,0.78)]"
                  style={{ animation: "scan-line-y 2.2s ease-in-out infinite alternate" }}
                />
                <div
                  className="absolute left-[14%] right-[14%] h-10 -translate-y-1/2 bg-[radial-gradient(circle,rgba(124,140,255,0.18),transparent_72%)] blur-md"
                  style={{ animation: "scan-line-y 2.2s ease-in-out infinite alternate" }}
                />
              </div>
            </div>

            {scanState === "success" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/18 backdrop-blur-[2px]">
                <div className="flex flex-col items-center rounded-[28px] border border-emerald-300/30 bg-emerald-500/18 px-7 py-6 text-center shadow-[0_18px_40px_rgba(16,185,129,0.18)]">
                  <CheckCircle2 size={54} className="text-emerald-200" />
                  <p className="m-0 mt-4 text-xl font-extrabold text-white">
                    {t("scannerScannedOk")}
                  </p>
                  <p className="m-0 mt-2 text-sm text-emerald-100/85">
                    {t("scannerOpeningOrder")}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100 backdrop-blur-md">
              <ScanLine size={14} />
              {isStarting
                ? t("scannerStarting")
                : scanState === "success"
                  ? t("scannerSuccessState")
                  : t("scannerReadyState")}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[28px] border border-[color:var(--color-border-soft)] bg-white/80 p-5 shadow-sm dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-maindark dark:text-white">
              <Sparkles size={16} className="text-main dark:text-[#a5b4fc]" />
              <p className="m-0 text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] dark:text-white/55">
                {t("scannerGuideTitle")}
              </p>
            </div>
            <h3 className="m-0 mt-3 text-2xl font-extrabold leading-tight text-maindark dark:text-white">
              {t("scannerGuideHeadline")}
            </h3>
            <p className="m-0 mt-2 text-sm leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("scannerGuideText")}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3 md:gap-2">
            {[t("scannerTipLight"), t("scannerTipCenter"), t("scannerTipHold")].map((tip) => (
              <div
                key={tip}
                className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/80 px-4 py-3 text-sm font-medium leading-5 text-maindark dark:bg-white/[0.04] dark:text-white/70"
              >
                {tip}
              </div>
            ))}
          </div>

          <div className="rounded-[28px] border border-[color:var(--color-border-soft)] bg-white/80 p-5 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-maindark/80 dark:text-white/80">
              <Camera size={16} />
              <p className="m-0 text-sm font-semibold">{t("scannerResultLabel")}</p>
            </div>

            {scanState === "success" ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200/75">
                  {t("success")}
                </p>
                <p className="m-0 mt-2 text-sm font-semibold text-maindark dark:text-white">
                  {t("scannerDetectedCode")}
                </p>
                <p className="m-0 mt-1 break-all text-sm text-emerald-100/90">
                  {scannedId || scanResult}
                </p>
              </div>
            ) : error ? (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="m-0">{error}</p>
                    {scanState === "invalid" && scanResult ? (
                      <p className="m-0 mt-2 break-all text-xs text-red-500/70 dark:text-red-100/70">
                        {scanResult}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border-soft)] px-4 py-5 text-sm leading-6 text-[color:var(--color-text-muted)] dark:text-white/48">
                {t("scannerWaitingText")}
              </div>
            )}

            {!cameraUnavailable ? (
              <button
                type="button"
                onClick={handleRestart}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark transition hover:border-main/30 hover:bg-main/5 hover:text-main dark:bg-maindark dark:text-white/80 dark:hover:bg-white/[0.09] dark:hover:text-white"
              >
                <RefreshCw size={15} />
                {t("retry")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ScanPage);
