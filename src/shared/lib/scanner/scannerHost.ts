import { useSyncExternalStore } from "react";
import { getActiveScanTarget } from "./scanTargets";

/**
 * KONTEKSTLI SKANER TUGMASI (ega qarori 2026-10-19): pastki menyuning markaziy «Skaner» tugmasi va yuqori
 * paneldagi «Skanerlash» shu ikki funksiyani chaqiradi.
 *
 *   - sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa (`useScanTarget`) — kamera SHU sahifa ustida, o'sha
 *     maqsad bilan ochiladi (navigatsiyasiz, sahifa holati saqlanadi);
 *   - aks holda universal skaner — `/scan`.
 *
 * Oynaning o'zi `widgets/scanner/ScannerHost` (shell'da bir marta). U shu do'konni tinglaydi va
 * `registerScannerNavigator` bilan router navigatsiyasini beradi.
 */

export const UNIVERSAL_SCANNER_PATH = "/scan";

/**
 * Maqsad almashganda (kamera ichida market tanlandi → boshqa sahifa) eski sahifa yopilib, yangisi hali
 * yuklanayotgan (lazy route) bo'lishi mumkin — shu oraliqda kamera yopilmaydi, oxirgi maqsad bilan turadi.
 */
export const SCANNER_TARGET_SWITCH_GRACE_MS = 1000;

type Navigate = (to: string) => void;

let overlayOpen = false;
let navigator: Navigate | null = null;
/** Ochiq kamera yuzalari soni (`ScannerCamera`): global `ScanFeedbackOverlay` shu paytda chiqmaydi. */
let cameraCount = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export type OpenScannerResult = "overlay" | "page";

/**
 * Skanerni ochadi: faol maqsad bor — kamera oynasi (`"overlay"`), yo'q — `/scan` ga o'tadi (`"page"`).
 * `navigate` berilmasa `ScannerHost` ro'yxatdan o'tkazgan navigatsiya ishlatiladi.
 */
export const openScanner = (options: { navigate?: Navigate } = {}): OpenScannerResult => {
  if (getActiveScanTarget()) {
    if (!overlayOpen) {
      overlayOpen = true;
      emit();
    }
    return "overlay";
  }
  (options.navigate ?? navigator)?.(UNIVERSAL_SCANNER_PATH);
  return "page";
};

export const closeScanner = () => {
  if (!overlayOpen) return;
  overlayOpen = false;
  emit();
};

export const isScannerOverlayOpen = () => overlayOpen;

export const useScannerOverlayOpen = () => useSyncExternalStore(subscribe, isScannerOverlayOpen, isScannerOverlayOpen);

/** `ScannerHost` router navigatsiyasini beradi (yechish funksiyasini qaytaradi). */
export const registerScannerNavigator = (navigate: Navigate) => {
  navigator = navigate;
  return () => {
    if (navigator === navigate) navigator = null;
  };
};

/** Kamera yuzasi ochildi/yopildi (`ScannerCamera` mount/unmount). */
export const markScannerCameraMounted = () => {
  cameraCount += 1;
  if (cameraCount === 1) emit();
  return () => {
    cameraCount = Math.max(0, cameraCount - 1);
    if (cameraCount === 0) emit();
  };
};

export const isScannerCameraMounted = () => cameraCount > 0;

export const useScannerCameraMounted = () => useSyncExternalStore(subscribe, isScannerCameraMounted, isScannerCameraMounted);

/** Faqat testlar uchun. */
export const resetScannerHost = () => {
  overlayOpen = false;
  navigator = null;
  cameraCount = 0;
  emit();
};
