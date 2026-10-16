import { useLayoutEffect, type RefObject } from "react";

/**
 * SHELL PASTKI CHEKKASI — telefonda (< 768) pastki menyu (`BottomNav`) oynaning pastini doim egallaydi.
 *
 * Shell uni `:root` ga `--shell-bottom-inset` (px; menyu ko'rinmasa — 0) qilib yozadi (`useShellBottomInsetSource`).
 * Portal qatlamlari `#ui-portal` da — shell ichidagi `--shell-bottomnav-h` ularga yetib bormaydi, shuning uchun
 * qiymat `:root` da turadi:
 *   - `usePopover` ro'yxat/kalendar/menyu panelini shu chiziqdan pastga tushirmaydi (joy yetmasa tepaga
 *     ag'daradi yoki balandligini kesadi) — panel pastki menyu ostida qolmaydi;
 *   - CSS'da: `bottom: var(--shell-bottom-inset, 0px)` (pastga yopishgan, modal bo'lmagan panel uchun).
 *
 * Modal varaqalar (`Dialog`, sana varaqasi) pastki menyuni ATAYLAB yopadi — taxta `tizim-responsive`:
 * «Skaner va dialoglar ochilganda pastki menyu yopiladi» (fon qoplamasi butun ekranda).
 */
export const SHELL_BOTTOM_INSET_VAR = "--shell-bottom-inset";

/** `:root` dagi pastki chekka (px). Shell'siz sahifada (kirish, skaner, test) — 0. */
export const readShellBottomInset = (): number => {
  if (typeof document === "undefined") return 0;
  const value = Number.parseFloat(document.documentElement.style.getPropertyValue(SHELL_BOTTOM_INSET_VAR));
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/** `null` — o'zgaruvchini olib tashlaydi (pastki menyu yo'q bo'ldi). */
export const writeShellBottomInset = (px: number | null) => {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  if (px === null) style.removeProperty(SHELL_BOTTOM_INSET_VAR);
  else style.setProperty(SHELL_BOTTOM_INSET_VAR, `${Math.max(0, Math.round(px))}px`);
};

/**
 * Pastki menyu elementi (`ref`) balandligini `:root` ga yozib turadi: `md:hidden` bilan yashirilsa — 0,
 * o'lchami o'zgarsa (`safe-area`, burilish) — yangilanadi, element yo'qolsa — o'zgaruvchi olib tashlanadi.
 * Faqat shell (`BottomNav`) chaqiradi; ilovada bitta manba.
 */
export const useShellBottomInsetSource = (ref: RefObject<HTMLElement | null>, enabled: boolean) => {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return undefined;
    // `display: none` (≥ 768) da balandlik 0 — ResizeObserver bu o'zgarishni ham xabar qiladi.
    const apply = () => writeShellBottomInset(element.getBoundingClientRect().height);
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(element);
    window.addEventListener("resize", apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
      writeShellBottomInset(null);
    };
  }, [ref, enabled]);
};
