import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * SHELL SKROLLI — bo'lim almashganda kontent tepaga qaytadi (2-bosqich).
 *
 * Skroll qiluvchi element — shell'ning `<main>` i (qobiq `h-dvh`, oyna o'zi
 * aylanmaydi), shuning uchun brauzerning o'z skroll tiklashi bu yerda ishlamaydi.
 *
 * Qoidalar (tanlangan xatti-harakat):
 * - `pathname` o'zgarsa (PUSH / REPLACE) — `<main>` tepaga (0).
 * - Faqat `?search` o'zgarsa (tab, filtr, sahifa raqami) — skroll JOYIDA qoladi:
 *   ro'yxat ustidagi filtrni bosgan foydalanuvchi sahifa boshiga otilmaydi.
 * - «Orqaga» / «Oldinga» (POP) — shu tarix yozuvining oldingi skroll joyi
 *   tiklanadi (ma'lumot hali yuklanayotgan bo'lsa ~1 s davomida kontent
 *   o'sishini kutib qayta urinadi; foydalanuvchi o'zi aylantirsa — to'xtaydi).
 *   Joy saqlanmagan bo'lsa — tepaga.
 */
const RESTORE_WINDOW_MS = 1000;

/** Tarix yozuvi (`location.key`) → `<main>` skroll joyi. Sessiya davomida xotirada. */
const savedPositions = new Map<string, number>();

export const useShellScroll = (scrollRef: RefObject<HTMLElement | null>) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKeyRef = useRef(location.key);
  const previousPathRef = useRef(location.pathname);

  // Joriy yozuvning skroll joyini yozib boramiz (keyin «Orqaga» uchun).
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const onScroll = () => {
      savedPositions.set(currentKeyRef.current, element.scrollTop);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  useLayoutEffect(() => {
    currentKeyRef.current = location.key;
    const pathChanged = previousPathRef.current !== location.pathname;
    previousPathRef.current = location.pathname;
    const element = scrollRef.current;
    if (!pathChanged || !element) return undefined;

    const saved = navigationType === "POP" ? savedPositions.get(location.key) : undefined;
    element.scrollTop = 0;
    if (!saved) return undefined;

    // Ma'lumot kelib kontent o'sguncha qayta urinish.
    let frame = 0;
    let stopped = false;
    const startedAt = performance.now();
    const stop = () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
    const attempt = () => {
      if (stopped) return;
      element.scrollTop = saved;
      if (Math.abs(element.scrollTop - saved) <= 1 || performance.now() - startedAt > RESTORE_WINDOW_MS) return;
      frame = window.requestAnimationFrame(attempt);
    };
    attempt();
    element.addEventListener("wheel", stop, { passive: true, once: true });
    element.addEventListener("touchstart", stop, { passive: true, once: true });
    return () => {
      stop();
      element.removeEventListener("wheel", stop);
      element.removeEventListener("touchstart", stop);
    };
  }, [location.key, location.pathname, navigationType, scrollRef]);
};

/** Faqat testlar uchun. */
export const __clearSavedScrollPositions = () => savedPositions.clear();
