// dizayn-v2: shell
import { memo, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { beginRouteSuspense, useRouteTransition } from "../../../shared/lib/navigationPending";

/**
 * YUQORI CHIZIQ — bo'limlar orasida o'tish (maket `tizim-loading` → «1 · Bo'limlar orasida o'tish»,
 * `.el-topprogress`: 3px, iz `action-soft`, to'ldirish `action`).
 *
 * - 150 ms gacha hech narsa ko'rinmaydi (tez javobda miltillash yo'q).
 * - Keyin chiziq 8% dan boshlab ~90% gacha sekin «yuradi» (faqat `transform` —
 *   maket `tizim-motion`: kenglik animatsiya qilinmaydi), tugaganda 100% va so'nadi.
 * - `absolute`: sahifa sakramaydi (layout shift yo'q).
 * - «Harakatni kamaytirish» yoqilgan bo'lsa o'tishlar yo'q — chiziq darhol joyida.
 */
export const ROUTE_PROGRESS_DELAY_MS = 150;
const FADE_MS = 400;

type Phase = "idle" | "start" | "grow" | "done";

const SCALE: Record<Exclude<Phase, "idle">, number> = { start: 0.08, grow: 0.9, done: 1 };

type RouteProgressBarProps = {
  /** Yuklanish davom etmoqda. */
  active: boolean;
};

export const RouteProgressBar = memo(({ active }: RouteProgressBarProps) => {
  const { t } = useTranslation("ui");
  const [phase, setPhase] = useState<Phase>("idle");

  // Yuklanish tugadi: ko'ringan chiziq 100% ga yetib so'nadi (holat render paytida tuzatiladi).
  // Faqat `active` o'zgargan paytni emas, har renderni tekshiradi: 150 ms taymeri yoki 8% → 90% kadri
  // `active` o'chgan commit bilan uning effekt tozalashi ORASIDA otilsa (tez yo'naltirish, masalan
  // menejer `/` → `/branch-dashboard`), chiziq «grow» da abadiy qotib qolardi.
  if (!active && (phase === "start" || phase === "grow")) setPhase("done");

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setPhase("start"), ROUTE_PROGRESS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (phase === "start") {
      // Bir kadr 8% da chizilsin, keyin `transition` 90% gacha olib boradi.
      const frame = window.requestAnimationFrame(() => setPhase((current) => (current === "start" ? "grow" : current)));
      return () => window.cancelAnimationFrame(frame);
    }
    if (phase === "done") {
      const timer = window.setTimeout(() => setPhase("idle"), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  if (phase === "idle") return null;

  const done = phase === "done";
  return (
    <div
      {...(done
        ? { "aria-hidden": true }
        : { role: "progressbar", "aria-label": t("shell.pageLoading"), "aria-valuemin": 0, "aria-valuemax": 100 })}
      data-route-progress={phase}
      className={`pointer-events-none absolute inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-action-soft transition-opacity duration-200 motion-reduce:transition-none ${
        done ? "opacity-0 delay-200" : "opacity-100"
      }`}
    >
      <span
        className={`block h-full origin-left bg-action transition-transform motion-reduce:transition-none ${
          phase === "grow" ? "duration-[8000ms] ease-out" : "duration-200 ease-out"
        }`}
        style={{ transform: `scaleX(${SCALE[phase]})` }}
      />
    </div>
  );
});
RouteProgressBar.displayName = "RouteProgressBar";

/** Shell'dagi chiziq: navigatsiya kutilayotganda yoki shell `<Suspense>` fallback'i ko'ringanda. */
const RouteProgress = () => {
  const { isLoading } = useRouteTransition();
  return <RouteProgressBar active={isLoading} />;
};

/**
 * Shell `<Suspense>` fallback'i: kontent joyi bo'sh qoladi (menyu va yuqori panel joyida),
 * yuqori chiziq esa shu komponent ko'ringan payt yonadi.
 */
export const RouteSuspenseFallback = () => {
  useLayoutEffect(() => beginRouteSuspense(), []);
  return null;
};

export default memo(RouteProgress);
