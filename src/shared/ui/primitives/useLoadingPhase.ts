import { useEffect, useState } from "react";

/**
 * KUTISH ZINAPOYASI — dizayn v2, taxta `tizim-loading` 01 («Kutish vaqti bo'yicha»)
 *
 *   0–150 ms   hech narsa (tez javobda miltillash yo'q)
 *   150 ms dan yuqori chiziq (bo'limlar orasida — shell'dagi `RouteProgress`)
 *   400 ms dan skelet, sahifa shaklida (`SKELETON_DELAY_MS`)
 *   15 s dan   skelet ostida «Kutish uzoq davom etmoqda…» (`SLOW_LOADING_MS`)
 *   20 s       so'rov to'xtatiladi → xato holati va «Qayta urinish» (axios `API_TIMEOUT_MS`)
 *
 * Fon yangilanishi («Yangilanmoqda…» belgisi) ham 400 ms dan qisqa so'rovda chiqmaydi (taxta 11-naqsh).
 */
export const SKELETON_DELAY_MS = 400;
export const SLOW_LOADING_MS = 15_000;

/**
 * `active` uzluksiz `delay` ms davomida `true` bo'lsagina `true` qaytaradi; `active` tushsa — darhol `false`
 * (keyingi yoqilishda vaqt boshidan). `delay <= 0` — kechikishsiz.
 */
export const useDelayedFlag = (active: boolean, delay: number) => {
  const [state, setState] = useState({ active, elapsed: false });
  // Hosila holat: `active` o'zgarsa — hisob boshidan (React'ning «oldingi chizishdan ma'lumot» naqshi).
  if (state.active !== active) setState({ active, elapsed: false });

  useEffect(() => {
    if (!active || delay <= 0) return;
    const timer = setTimeout(() => setState((current) => (current.active ? { ...current, elapsed: true } : current)), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return active && (delay <= 0 || state.elapsed);
};

export type LoadingPhaseOptions = {
  /** Skelet shundan keyin ko'rinadi, ms (sukut 400). */
  delay?: number;
  /** «Kutish uzoq davom etmoqda» shundan keyin, ms (sukut 15 000); `false` — hech qachon. */
  slowAfter?: number | false;
};

/**
 * Yuklanish bosqichi: `visible` — skeletni ko'rsatish vaqti keldi (400 ms), `slow` — izoh vaqti (15 s).
 *
 *   const { visible, slow } = useLoadingPhase(query.isLoading);
 */
export const useLoadingPhase = (
  active: boolean,
  { delay = SKELETON_DELAY_MS, slowAfter = SLOW_LOADING_MS }: LoadingPhaseOptions = {},
) => {
  const visible = useDelayedFlag(active, delay);
  const slowArmed = useDelayedFlag(active && slowAfter !== false, slowAfter === false ? 0 : slowAfter);
  return { visible, slow: slowAfter !== false && slowArmed };
};
