import { useSyncExternalStore } from "react";

/**
 * Shell'ning sahifa bannerlari joyi (`[data-shell-slot=banner]`, `widgets/layout/dashboardLayout.tsx`).
 *
 * Taxta `tizim-feedback` 04 «Sahifa bannerlari»: banner yuqori panel ostida turadi va «sahifani pastga suradi —
 * hech narsani yopmaydi». Shell slotni ref orqali shu yerga yozadi; banner (`auth/SessionExpiryCountdown`,
 * ilovada bir marta, shell'dan tashqarida o'rnatilgan) unga portal qiladi. Slot yo'q qobiqda (`ScanLayout`,
 * mustaqil sahifalar) `null` — banner o'z joyida chiziladi.
 *
 * Entry chunk'da (banner shu yerdan o'qiydi) — faqat React, boshqa import yo'q.
 */
let bannerSlot: HTMLElement | null = null;
const listeners = new Set<() => void>();

const setSlot = (node: HTMLElement | null) => {
  if (bannerSlot === node) return;
  bannerSlot = node;
  listeners.forEach((listener) => listener());
};

/**
 * Shell slotining ref'i (React 19 ref tozalagichi bilan): o'rnatilganda element yoziladi, olib tashlanganda —
 * faqat o'sha element hali joriy bo'lsa — `null`. Ikki qobiq bir lahza ustma-ust tursa, eskisining tozalanishi
 * yangisini o'chirmaydi.
 */
export const setShellBannerSlot = (node: HTMLElement | null) => {
  if (!node) return undefined;
  setSlot(node);
  return () => {
    if (bannerSlot === node) setSlot(null);
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => bannerSlot;
const getServerSnapshot = () => null;

/** Hozirgi banner slot elementi (shell o'rnatilmagan bo'lsa `null`). */
export const useShellBannerSlot = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
