import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { playScanSignal, SCAN_FEEDBACK_EVENT, type ScanFeedbackDetail } from "../../lib/scanner/feedback";
import type { ScanSource } from "../../lib/scanner/scanTargets";
import type { CameraFacing, QrScanRegion } from "../../lib/qrScanner";
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

/**
 * Ruxsat izohi shu sahifa yuklanishida bir marta: «Kamerani yoqish» bosilgach keyingi ochilishlarda (oyna qayta
 * ochildi, 768 px chegarasi kesildi — `/scan` kamerani qayta yaratadi) brauzer o'zi so'raydi. iOS Safari doimiy
 * ruxsatsiz `prompt` qaytaradi — aks holda karta har ochilishda chiqardi.
 */
let permissionExplained = false;

/** Faqat testlar uchun. */
export const resetCameraPermissionExplained = () => {
  permissionExplained = false;
};

export type CameraResult = {
  id: number;
  /** `tooFast` — kamera o'zi rad etgan skan (sahifaga yetmaydi). */
  type: ScanFeedbackDetail["type"] | "tooFast";
  message?: string;
  /** Xabar ostidagi izoh qatori (`playScanFeedback(..., { text })`). */
  text?: string;
  /** Oraliq qadam — «bitta kod» rejimida kamera yopilmaydi. */
  step?: boolean;
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
  /**
   * `false` — kamera ishlayveradi, lekin o'qilgan kodlar hech qayerga yuborilmaydi (masalan maqsad almashish
   * oralig'ida: eski sahifa yopilgan, yangisi hali ro'yxatdan o'tmagan — skan noto'g'ri marketga tushmasin).
   */
  scanEnabled?: boolean;
  /**
   * `<video>` elementi almashadigan ko'rinish kaliti (telefon ↔ keng oyna, 768 px chegarasi). O'zgarsa skaner
   * yangi elementda qayta ishga tushadi — aks holda oqim olib tashlangan `<video>` da qolib, ekran qora bo'lardi.
   */
  layoutKey?: string | number | boolean;
  onScan: (raw: string, source: ScanSource) => void | Promise<void>;
  /** Ochilishdagi kamera (Sozlamalar → Skaner → «Asosiy kamera»). */
  preferredCamera?: CameraFacing;
  /** Skan hududi — ekrandagi ramka (`scanRegion.ts`). */
  calculateScanRegion?: (video: HTMLVideoElement) => QrScanRegion;
};

export const useScannerCameraSession = ({
  videoRef,
  active,
  scanEnabled = true,
  layoutKey,
  onScan,
  preferredCamera,
  calculateScanRegion,
}: Options) => {
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
  // Kadrda turgan kod jim (takror oynasi suriladi) — kod ramkada turgan ekan qayta yuborilmaydi.
  const { evaluateScan } = useScannerGate({
    cooldownMs: CAMERA_COOLDOWN_MS,
    duplicateCooldownMs: CAMERA_DUPLICATE_MS,
    slidingDuplicate: true,
  });
  const scanEnabledRef = useRef(scanEnabled);
  /** «Juda tez» bildirilgan oxirgi kod — keyingi kadrlari jim (kamera sekundiga ~25 kadr o'qiydi). */
  const tooFastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    scanEnabledRef.current = scanEnabled;
  }, [scanEnabled]);

  const showResult = useCallback((type: CameraResult["type"], message?: string, extra?: Pick<CameraResult, "text" | "step">) => {
    resultIdRef.current += 1;
    setResult({ id: resultIdRef.current, type, message, ...extra });
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
      showResult(detail.type, detail.message, { text: detail.text, step: detail.step });
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
  // «Kamerani yoqish» yoki «Qayta urinish» bosilgandan keyin izoh kartasi qaytmaydi (`permissionExplained`).
  useEffect(() => {
    let cancelled = false;
    void queryCameraPermission().then((permission: CameraPermission) => {
      if (cancelled) return;
      if (permission === "denied") setGate("denied");
      else if (permission === "prompt" && !permissionExplained) setGate("prompt");
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
      if (!scanEnabledRef.current) return;
      const verdict = evaluateScan(raw);
      // Kamera bir kodni har kadrda qayta o'qiydi — takror jim (taxta 04.6).
      if (verdict === "duplicate") return;
      if (verdict === "cooldown") {
        // Jim tashlamaymiz: operator bilsin (taxta 04.10). Lekin bir kod uchun bir marta — kod kadrda qolsa
        // keyingi kadrlar jim, pauza tugagach u o'zi qabul qilinadi (har kadrga xato ovozi chalinmaydi).
        const key = raw.trim().toLowerCase();
        if (tooFastTokenRef.current === key) return;
        tooFastTokenRef.current = key;
        playScanSignal("error");
        showResult("tooFast");
        return;
      }
      tooFastTokenRef.current = null;
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
    preferredCamera,
    calculateScanRegion,
    // Chiroq yoqilmadi — kamera ishlayveradi, «Kamera ochilmadi» kartasi emas, qisqa xabar.
    onTorchError: () => {
      playScanSignal("error");
      showResult("error", t("camera.torchFailed"));
    },
  });

  // Ko'rinish almashdi (768 px chegarasi): `<video>` boshqa joyda qayta yaratildi — skaner yangisiga ulanadi.
  const { restartScanner: restartOnLayout } = camera;
  const layoutKeyRef = useRef(layoutKey);
  useEffect(() => {
    if (layoutKeyRef.current === layoutKey) return;
    layoutKeyRef.current = layoutKey;
    setFeedLive(false);
    restartOnLayout();
  }, [layoutKey, restartOnLayout]);

  const deniedOnStart = camera.cameraErrorKind === "denied";
  const denied = gate === "denied" || deniedOnStart;
  const failedKind = denied ? null : camera.cameraUnavailable ? "unsupported" : camera.cameraErrorKind;

  // Ruxsat rad etilgan, kamera band yoki ochilmadi — xato ovozi (taxta 04.2, 04.14 «Ovoz: xato»), bir marta.
  // «Qo'llab-quvvatlanmaydi» — qurilma xususiyati, ovozsiz.
  const failure = denied ? "denied" : failedKind && failedKind !== "unsupported" ? failedKind : null;
  const signalledRef = useRef<string | null>(null);
  useEffect(() => {
    if (failure && signalledRef.current !== failure) playScanSignal("error");
    signalledRef.current = failure;
  }, [failure]);

  /** «Kamerani yoqish» (izoh kartasi) — brauzer ruxsat so'raydi. */
  const enable = useCallback(() => {
    permissionExplained = true;
    setFeedLive(false);
    setGate("ready");
  }, []);

  /** «Qayta urinish»: ruxsat qayta tekshiriladi va kamera qaytadan ishga tushadi. */
  const { restartScanner } = camera;
  const retry = useCallback(() => {
    permissionExplained = true;
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
    canSwitchCamera: camera.canSwitchCamera,
    switchCamera: camera.switchCamera,
    setFeedLive,
    enable,
    retry,
    showResult,
  };
};
