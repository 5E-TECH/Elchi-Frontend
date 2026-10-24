import { useEffect, useState } from "react";

/** Qiymat o'zgargandan keyin `delayMs` o'tgach yangilanadi (har harfga so'rov ketmasin). */
export const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};
