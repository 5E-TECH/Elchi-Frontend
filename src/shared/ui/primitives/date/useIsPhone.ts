import { useSyncExternalStore } from "react";

/** Telefon (< 768) — maket `@container el (max-width:767px)`, Tailwind `max-md:`. */
export const PHONE_QUERY = "(max-width: 767px)";

const hasMatchMedia = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (onChange: () => void) => {
  if (!hasMatchMedia()) return () => undefined;
  const list = window.matchMedia(PHONE_QUERY);
  list.addEventListener?.("change", onChange);
  return () => list.removeEventListener?.("change", onChange);
};

const getSnapshot = () => hasMatchMedia() && window.matchMedia(PHONE_QUERY).matches;

/**
 * Telefon kengligidami: kalendar telefonda pastki varaqada va BITTA oy bilan ochiladi
 * (planshet/desktop — maydon ostida popover, ikki oy). Klaviatura navigatsiyasi ko'rinadigan oylar
 * sonini bilishi kerak, shuning uchun bu CSS emas, JS'da (`matchMedia`). SSR/testda — `false`.
 */
export const useIsPhone = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => false);
