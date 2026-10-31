import { useCallback, useSyncExternalStore, type RefObject } from "react";
import { isEditableTarget, isIgnoredTarget } from "./useKeyboardScanner";

/** Kamera oynasi ham `aria-modal`, lekin u skanerni to'smaydi (`tizim-scanner` §01: kamera USB ni to'smaydi). */
const hasBlockingModal = () =>
  Array.from(document.querySelectorAll('[aria-modal="true"]')).some(
    (modal) => !modal.closest("[data-scanner-camera]"),
  );

/**
 * Ekran USB skanerni HOZIR eshitadimi: brauzer oynasi faol (aks holda bosishlar sahifaga umuman kelmaydi), modal
 * oyna yopiq va fokus begona matn maydonida emas. Skan maydonining o'zi (`field`) — tinglash joyi, begona emas.
 */
export const isScannerListening = (field: HTMLElement | null) => {
  if (!document.hasFocus() || hasBlockingModal()) return false;
  const active = document.activeElement;
  return active === field || !(isEditableTarget(active) || isIgnoredTarget(active));
};

const subscribe = (onChange: () => void) => {
  const dom = new MutationObserver(onChange);
  dom.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("focusin", onChange);
  document.addEventListener("focusout", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);

  return () => {
    dom.disconnect();
    document.removeEventListener("focusin", onChange);
    document.removeEventListener("focusout", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
};

/**
 * «USB skaner tayyor» belgisining yagona manbasi (`tizim-scanner`: chip ulanishni emas, ilova skanerni
 * tinglayotganini bildiradi). `useKeyboardScanner` ning `enabled` iga ham shu qiymat beriladi: belgi bor — skan
 * tutiladi, belgi yo'q (modal ochiq, boshqa maydonga yozilmoqda, boshqa oyna faol) — ushlanmaydi.
 */
export const useScannerListening = (fieldRef: RefObject<HTMLElement | null>) => {
  const getSnapshot = useCallback(() => isScannerListening(fieldRef.current), [fieldRef]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
