import { useCallback, useSyncExternalStore } from "react";

/** Telefon (< 768) — maket `@container el (max-width:767px)`, Tailwind `max-md:`. */
export const PHONE_QUERY = "(max-width: 767px)";
/** Desktop (≥ 1024) — qidiruv maydoni yuqori panelda; undan torda qidiruv ekrani. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

const matches = (query: string) =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;

/** `window.matchMedia` holati, o'zgarsa qayta chiziladi (SSR/testda `matchMedia` bo'lmasa — `false`). */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener?.("change", onChange);
      return () => list.removeEventListener?.("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
};

/** Hodisa paytidagi holat (hook emas — tugma bosilganda yoki klaviatura yorlig'ida tekshirish uchun). */
export const matchesMedia = matches;
