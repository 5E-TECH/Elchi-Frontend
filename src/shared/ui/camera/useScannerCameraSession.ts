import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { playScanSignal, SCAN_FEEDBACK_EVENT, type ScanFeedbackDetail } from "../../lib/scanner/feedback";
import type { ScanSource } from "../../lib/scanner/scanTargets";
import { useCameraQrScanner } from "../../lib/useCameraQrScanner";
import { useScannerGate } from "../../lib/useScannerGate";
import { queryCameraPermission, watchCameraPermission, type CameraPermission } from "./cameraPermission";

/** Taxta `tizim-scanner`: kamera pauzasi 700 ms, takror himoyasi 1800 ms (USB'da pauza yo'q). */
export const CAMERA_COOLDOWN_MS = 700;
export const CAMERA_DUPLICATE_MS = 1800;
/** Natija xabari 2–3 s (taxta §03 «Natija xabari»). */
export const RESULT_VISIBLE_MS = 2500;
/** Ramka rangi + belgi — keyingi skangacha (700 ms). */
export const FLASH_MS = 700;

export type CameraResult = {
  id: number;
  /** `tooFast` — kamera o'zi rad etgan skan (sahifaga yetmaydi). */
  type: ScanFeedbackDetail["type"] | "tooFast";
  message?: string;
};

/**
 * Kamera holati: ruxsat → ishga tushirish → uzluksiz skan.
 *
 *   - `checking` — ruxsat so'ralmoqda (`navigator.permissions`), kamera hali yoqilmaydi;
 *   - `prompt` — ruxsat izohi kartasi, «Kamerani yoqish» bosilgach brauzer so'raydi;
 *   - `denied` — ruxsat yo'q (oldindan ma'lum yoki ishga tushishda rad etildi);
 *   - `ready` — kamera yoqiladi (`active` bo'lsa).
 */
export type CameraGate = "checking" | "prompt" | "denied" | "ready";

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Kamera yoqilsinmi (varaq ochiq bo'lsa — to'xtaydi). */
  active: boolean;
  onScan: (raw: string, source: ScanSource) => void | Promise<void>;
};

export const useScannerCameraSession = ({ videoRef, active, onScan }: Options) => {
  const { t } = useTranslation("ui");
  const [gate, setGate] = useState<CameraGate>("checking");
  const [checkSession, setCheckSession] = useState(0);
  const [feedLive, setFeedLive] = useState(false);
  const [result, setResult] = useState<CameraResult | null>(null);
  const [flash, setFlash] = useState<CameraResult["type"] | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const onScanRef = useRef(onScan);
  const resultTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const resultIdRef = useRef(0);
  const { evaluateScan } = useScannerGate({ cooldownMs: CAMERA_COOLDOWN_MS, duplicateCooldownMs: CAMERA_DUPLICATE_MS });

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const showResult = useCallback((type: CameraResult["type"], message?: string) => {
    resultIdRef.current += 1;
    setResult({ id: resultIdRef.current, type, message });
    setFlash(type);
    if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    resultTimerRef.current = window.setTimeout(() => setResult(null), RESULT_VISIBLE_MS);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  useEffect(
    () => () => {
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    },
    [],
  );

  // Natija sahifadan keladi: maqsad `playScanFeedback(...)` chaqiradi (USB skan ham) — xabar kamera ichida.
  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const detail = (event as CustomEvent<ScanFeedbackDetail>).detail;
      if (!detail?.type) return;
      showResult(detail.type, detail.message);
    };
    window.addEventListener(SCAN_FEEDBACK_EVENT, handleFeedback);
    return () => window.removeEventListener(SCAN_FEEDBACK_EVENT, handleFeedback);
  }, [showResult]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Ruxsat: oldindan so'raladi («prompt» — izoh kartasi; «denied» — yo'riqnoma, kamera yoqilmaydi).
  // «Kamerani yoqish» yoki «Qayta urinish» bosilgandan keyin izoh kartasi qaytmaydi — brauzer o'zi so'raydi.
  const explainedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void queryCameraPermission().then((permission: CameraPermission) => {
      if (cancelled) return;
      if (permission === "denied") setGate("denied");
      else if (permission === "prompt" && !explainedRef.current) setGate("prompt");
      else setGate("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [checkSession]);

  // Foydalanuvchi sozlamada ruxsat berdi — kamera o'zi ochiladi.
  useEffect(
    () =>
      watchCameraPermission((permission) => {
        if (permission === "granted") setGate((current) => (current === "denied" ? "ready" : current));
        if (permission === "denied") setGate("denied");
      }),
    [],
  );

  const handleDecode = useCallback(
    (raw: string) => {
      const verdict = evaluateScan(raw);
      // Kamera bir kodni har kadrda qayta o'qiydi — takror jim (taxta 04.6).
      if (verdict === "duplicate") return;
      if (verdict === "cooldown") {
        // Jim tashlamaymiz: operator qayta skanerlashi kerak (taxta 04.10).
        playScanSignal("error");
        showResult("tooFast");
        return;
      }
      void Promise.resolve()
        .then(() => onScanRef.current(raw, "camera"))
        .catch(() => undefined);
    },
    [evaluateScan, showResult],
  );

  const camera = useCameraQrScanner({
    isActive: active && gate === "ready",
    videoRef,
    onDecode: handleDecode,
    startErrorMessage: t("camera.failed.text"),
  });

  const deniedOnStart = camera.cameraErrorKind === "denied";
  const denied = gate === "denied" || deniedOnStart;
  const failedKind = denied ? null : camera.cameraUnavailable ? "unsupported" : camera.cameraErrorKind;

  // Ruxsat rad etilgan holat — xato ovozi (taxta 04.2 «Ovoz: xato»), bir marta.
  const deniedSignalledRef = useRef(false);
  useEffect(() => {
    if (denied && !deniedSignalledRef.current) {
      deniedSignalledRef.current = true;
      playScanSignal("error");
    }
    if (!denied) deniedSignalledRef.current = false;
  }, [denied]);

  /** «Kamerani yoqish» (izoh kartasi) — brauzer ruxsat so'raydi. */
  const enable = useCallback(() => {
    explainedRef.current = true;
    setFeedLive(false);
    setGate("ready");
  }, []);

  /** «Qayta urinish»: ruxsat qayta tekshiriladi va kamera qaytadan ishga tushadi. */
  const { restartScanner } = camera;
  const retry = useCallback(() => {
    explainedRef.current = true;
    setFeedLive(false);
    setGate("checking");
    setCheckSession((value) => value + 1);
    restartScanner();
  }, [restartScanner]);

  const running = active && gate === "ready" && !denied && !failedKind;
  const starting = running && (camera.isStarting || !feedLive);

  return {
    gate,
    denied,
    failedKind,
    running,
    starting,
    online,
    result,
    flash,
    hasTorch: camera.hasTorch,
    torchEnabled: camera.torchEnabled,
    toggleTorch: camera.toggleTorch,
    setFeedLive,
    enable,
    retry,
    showResult,
  };
};
