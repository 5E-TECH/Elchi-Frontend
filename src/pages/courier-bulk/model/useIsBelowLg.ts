import { useSyncExternalStore } from "react";

/** Planshet va telefon (< 1024) — maket `@container el (max-width:1023px)`, Tailwind `max-lg:`. */
const BELOW_LG_QUERY = "(max-width: 1023px)";

const hasMatchMedia = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribe = (onChange: () => void) => {
  if (!hasMatchMedia()) return () => undefined;
  const list = window.matchMedia(BELOW_LG_QUERY);
  list.addEventListener?.("change", onChange);
  return () => list.removeEventListener?.("change", onChange);
};

const getSnapshot = () => hasMatchMedia() && window.matchMedia(BELOW_LG_QUERY).matches;

/**
 * < 1024 mi: «Tezkor amal» ro'yxati planshetda ham kartalar (maket `courier-courier-bulk-main` — jadval
 * `el-hide-tablet`, ro'yxat `el-show-tablet`). JS'da tanlanadi — DOM'da bitta nusxa (natija tugmalari ikki marta
 * chizilmaydi). SSR/testda — `false` (jadval).
 */
export const useIsBelowLg = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => false);
