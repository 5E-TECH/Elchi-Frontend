import { useEffect, type RefObject } from "react";

/** Maydon bilan to'siq (panel / klaviatura) orasidagi bo'sh joy, px. */
const GAP = 12;

const isEditable = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

/** Eng yaqin vertikal skroll konteyneri — ilovada bu `<main>`, document emas. */
const scrollParentOf = (el: HTMLElement): HTMLElement | null => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
};

/**
 * Maydonni ko'rinadigan oraliqqa [top, bottom] olib kirish uchun kerakli
 * skroll siljishi (musbat — pastga). Oraliqqa sig'sa 0.
 */
export const revealOffset = (field: { top: number; bottom: number }, area: { top: number; bottom: number }) => {
  if (field.bottom > area.bottom) return Math.min(field.bottom - area.bottom, field.top - area.top);
  if (field.top < area.top) return field.top - area.top;
  return 0;
};

/**
 * KLAVIATURA OCHILGANDA tahrirlanayotgan maydon ko'rinib tursin (JzQIec06, TC10).
 *
 * Telefonda klaviatura ochilsa ko'rinadigan oyna (`visualViewport`) kichrayadi.
 * Brauzer fokusdagi maydonni o'zi skroll qiladi, lekin pastdagi yopishgan
 * "Tayyorlarini yaratish" panelini bilmaydi — maydon panel yoki klaviatura
 * ostida qolishi mumkin edi. Shu yerda: oyna o'zgarganda va maydonlar orasida
 * o'tilganda fokusdagi maydon panel / klaviatura USTIGA skroll qilinadi.
 */
export const useKeepFocusedFieldVisible = (
  containerRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) => {
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;

    const reveal = () => {
      const field = document.activeElement;
      if (!isEditable(field) || !containerRef.current?.contains(field)) return;
      const scroller = scrollParentOf(field);
      if (!scroller) return;

      const viewport = window.visualViewport;
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const scrollerBox = scroller.getBoundingClientRect();
      const barTop = barRef.current?.getBoundingClientRect().top ?? Infinity;

      const offset = revealOffset(field.getBoundingClientRect(), {
        top: Math.max(visibleTop, scrollerBox.top) + GAP,
        bottom: Math.min(visibleBottom, scrollerBox.bottom, barTop) - GAP,
      });
      if (offset !== 0) scroller.scrollTop += offset;
    };

    // Brauzerning o'z skrollidan KEYIN tuzatiladi.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    };

    const viewport = window.visualViewport;
    const resizeTarget: EventTarget = viewport ?? window;
    resizeTarget.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resizeTarget.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
    };
  }, [barRef, containerRef, enabled]);
};
