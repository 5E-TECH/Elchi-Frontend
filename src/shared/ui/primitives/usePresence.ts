import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  YOPILISH HARAKATI (presence) — dizayn v2, taxta `tizim-motion` 01–04
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ochilish CSS'da (`starting:` — `@starting-style`), yopilish esa element DOM'da qolishini talab qiladi:
 *  `open=false` bo'lgach panel `data-state="closed"` bilan 200 ms (chiqish egri chizig'i) ko'rinib turadi,
 *  `transitionend` (yoki zaxira taymer) dan keyin olib tashlanadi.
 *
 *  Harakat bo'lmaydigan muhitda element DARHOL olib tashlanadi:
 *    - «Harakatni kamaytirish» yoqilgan (`prefers-reduced-motion: reduce`) — `tizim-motion` 04;
 *    - CSS o'tishlari yo'q (jsdom testlari: `TransitionEvent` yo'q) — test yopilgandan keyin oynani
 *      DOM'da topmaydi, kutish shart emas.
 */

/** Zaxira: `transitionend` kelmasa (fon yorlig'i, o'tish bekor qilindi) — chiqish 200 ms + chegara. */
const EXIT_FALLBACK_MS = 260;

/** Yopilish harakati ko'rsatiladimi: brauzerda CSS o'tishlari bor va «Harakatni kamaytirish» o'chiq. */
export const canAnimateExit = (): boolean => {
  if (typeof window === "undefined" || typeof window.TransitionEvent !== "function") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
};

export type PresenceOptions = {
  /** Element DOM'dan butunlay olib tashlangach (chiqish harakati tugagach yoki darhol). */
  onExited?: () => void;
};

export type Presence = {
  /** Element DOM'da turishi kerakmi (ochiq yoki yopilish harakati davom etmoqda). */
  mounted: boolean;
  /** Yopilish harakati ketmoqda (`open=false`, element hali DOM'da) — `data-state="closed"`, `inert`. */
  exiting: boolean;
  /** Harakat tugadi — elementni olib tashlash (panelning `onTransitionEnd` idan). */
  finish: () => void;
};

/**
 *   const presence = usePresence(open, { onExited });
 *   if (!presence.mounted) return null;
 *   <div data-state={presence.exiting ? "closed" : "open"}
 *        onTransitionEnd={(e) => e.target === e.currentTarget && presence.exiting && presence.finish()} />
 *
 * Holat render paytida hisoblanadi (effektda `setState` emas): `open` o'zgargan render'ning o'zida
 * `mounted` tayyor — harakatsiz muhitda yopilgan oyna o'sha commit'da yo'qoladi.
 */
export const usePresence = (open: boolean, { onExited }: PresenceOptions = {}): Presence => {
  const [snapshot, setSnapshot] = useState(() => ({ open, mounted: open }));
  let current = snapshot;
  if (snapshot.open !== open) {
    // Ochilsa — darhol; yopilsa — harakat bo'lsa DOM'da qoladi, bo'lmasa darhol olib tashlanadi.
    current = { open, mounted: open || (snapshot.mounted && canAnimateExit()) };
    setSnapshot(current);
  }
  const exiting = !current.open && current.mounted;

  const finish = useCallback(() => {
    setSnapshot((state) => (state.open || !state.mounted ? state : { ...state, mounted: false }));
  }, []);

  // Zaxira taymer: `transitionend` kelmasa ham element qolib ketmaydi.
  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(finish, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, finish]);

  const onExitedRef = useRef(onExited);
  useEffect(() => {
    onExitedRef.current = onExited;
  });

  const wasMountedRef = useRef(current.mounted);
  useEffect(() => {
    if (wasMountedRef.current && !current.mounted) onExitedRef.current?.();
    wasMountedRef.current = current.mounted;
  }, [current.mounted]);

  return { mounted: current.mounted, exiting, finish };
};
