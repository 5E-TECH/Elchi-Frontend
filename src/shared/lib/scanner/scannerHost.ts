import { useSyncExternalStore } from "react";
import type { ScanSource } from "./feedback";
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

/**
 * «KELGANDA KAMERANI OCH» (3-bosqich, universal skaner rejimlari): `/scan` (`ScanLayout`) dan boshqa bo'limga
 * o'tilganda kamera o'sha sahifada ochiq holda davom etishi kerak — «Qabul qilish» → `/new-orders/<marketId>`,
 * «Kuryerga biriktirish» → `/dispatch`. `ScannerHost` esa dashboard shell'da, shuning uchun bayroq router
 * holatida (`navigate(path, { state: scannerArrivalState(...) })`) yuboriladi. `ScannerHost` kelgan sahifaning
 * maqsadi (`targetId` berilsa — aynan shu) ro'yxatdan o'tishini kutadi, kamerani ochadi va bayroqni tozalaydi
 * (orqaga qaytish yoki sahifani yangilash kamerani qayta ochmaydi). `pendingScan` — `/scan` da o'qilgan kod:
 * kamera ochilgach sahifa maqsadining `onScan` iga beriladi (sahifa handler'i — ikkinchi mantiq yozilmaydi).
 */
export const SCANNER_ARRIVAL_STATE_KEY = "openScanner";

/** Maqsad shu vaqtda ro'yxatdan o'tmasa (ro'yxat bo'sh, ruxsat yo'q) bayroq tashlanadi — kamera ochilmaydi. */
export const SCANNER_ARRIVAL_TIMEOUT_MS = 15_000;

export type ScannerArrival = {
  /** Kutiladigan maqsad (`ScanTarget.id`); berilmasa — birinchi faol maqsad. */
  targetId?: string;
  pendingScan?: { raw: string; source: ScanSource };
};

export const scannerArrivalState = (arrival: ScannerArrival = {}) => ({ [SCANNER_ARRIVAL_STATE_KEY]: arrival });

/** Router holatidan bayroq (yo'q yoki buzilgan bo'lsa — `null`). */
export const readScannerArrival = (state: unknown): ScannerArrival | null => {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[SCANNER_ARRIVAL_STATE_KEY];
  if (!value || typeof value !== "object") return null;
  const source = value as { targetId?: unknown; pendingScan?: unknown };
  const pending = source.pendingScan as { raw?: unknown; source?: unknown } | undefined;
  return {
    targetId: typeof source.targetId === "string" ? source.targetId : undefined,
    pendingScan:
      pending && typeof pending.raw === "string" && pending.raw.trim()
        ? {
            raw: pending.raw,
            source: pending.source === "keyboard" || pending.source === "manual" ? pending.source : "camera",
          }
        : undefined,
  };
};

/** Router holatining bayroqsiz nusxasi (boshqa maydonlar saqlanadi); bo'sh qolsa — `null`. */
export const withoutScannerArrival = (state: unknown): unknown => {
  if (!state || typeof state !== "object") return state ?? null;
  const rest: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  delete rest[SCANNER_ARRIVAL_STATE_KEY];
  return Object.keys(rest).length > 0 ? rest : null;
};

/** Faqat testlar uchun. */
export const resetScannerHost = () => {
  overlayOpen = false;
  navigator = null;
  cameraCount = 0;
  emit();
};
