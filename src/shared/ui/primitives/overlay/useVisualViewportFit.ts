import { useEffect, useState } from "react";

/**
 * TELEFON KLAVIATURASI (vNcGDnNh, 1-band). Klaviatura ochilganda brauzer faqat KO'RINADIGAN oynani (`visualViewport`)
 * kichraytiradi, `position: fixed` qatlam esa butun maket oynasiga bog'liq qoladi — pastdan chiqqan varaqa klaviatura
 * ostida qoladi (iOS Safari, Android Chrome «resizes-visual»). Klaviatura ochiq bo'lsa (ko'rinadigan oyna
 * `KEYBOARD_MIN_PX` dan ko'proq kichraygan) — ko'rinadigan oynaning tepasi va balandligi; aks holda `null`.
 * Qatlam shu o'lchamga joylashtiriladi, varaqa klaviatura ustida turadi va ichida skrollanadi.
 */
export type VisualViewportFit = { top: number; height: number };

/** Shundan kichik farq — klaviatura emas (manzil satri yig'ilishi, brauzer paneli). */
const KEYBOARD_MIN_PX = 120;

const read = (): VisualViewportFit | null => {
  if (typeof window === "undefined") return null;
  const viewport = window.visualViewport;
  if (!viewport) return null;
  const hidden = window.innerHeight - viewport.height;
  if (hidden < KEYBOARD_MIN_PX) return null;
  return { top: Math.max(0, Math.round(viewport.offsetTop)), height: Math.round(viewport.height) };
};

export const useVisualViewportFit = (enabled: boolean): VisualViewportFit | null => {
  const [fit, setFit] = useState<VisualViewportFit | null>(null);

  useEffect(() => {
    const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!enabled || !viewport) {
      setFit(null);
      return undefined;
    }
    const update = () =>
      setFit((previous) => {
        const next = read();
        if (previous === next) return previous;
        if (previous && next && previous.top === next.top && previous.height === next.height) return previous;
        return next;
      });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return enabled ? fit : null;
};
