import { useSyncExternalStore } from "react";

/**
 * Skaner natijasi sahifasining breakpointlari (JS'da): maketda bir xil amal tugmasi ikki joyda turadi —
 * desktopda yon «Amallar» kartasida, planshet va telefonda pastga yopishgan panelda; sarlavha ham
 * telefonda boshqacha (`.el-mtop`). DOM'da faqat BITTA nusxa chiziladi (ekran o'quvchi ikki marta
 * o'qimaydi, testdagi `getByRole` bitta tugma topadi). SSR va jsdom (matchMedia `false`) — desktop.
 */
const BELOW_LG = "(max-width: 1023px)";
const BELOW_MD = "(max-width: 767px)";

const hasMatchMedia = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribeTo = (query: string) => (onChange: () => void) => {
  if (!hasMatchMedia()) return () => undefined;
  const list = window.matchMedia(query);
  list.addEventListener?.("change", onChange);
  return () => list.removeEventListener?.("change", onChange);
};

const snapshotOf = (query: string) => () => hasMatchMedia() && window.matchMedia(query).matches;

const subscribeBelowLg = subscribeTo(BELOW_LG);
const subscribeBelowMd = subscribeTo(BELOW_MD);
const getBelowLg = snapshotOf(BELOW_LG);
const getBelowMd = snapshotOf(BELOW_MD);
const serverSnapshot = () => false;

/** Planshet va telefon (< 1024) — maket `.el-show-tablet` / `.el-hide-tablet`, Tailwind `max-lg:`. */
export const useIsBelowLg = (): boolean => useSyncExternalStore(subscribeBelowLg, getBelowLg, serverSnapshot);

/** Telefon (< 768) — maket `.el-show-mobile` / `.el-hide-mobile`, Tailwind `max-md:`. */
export const useIsBelowMd = (): boolean => useSyncExternalStore(subscribeBelowMd, getBelowMd, serverSnapshot);
