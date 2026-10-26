import { useLayoutEffect, useState, type RefObject } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

/**
 * QATOR VIRTUALIZATSIYASI (F4RSPBwx) — uzun ro'yxatda (masalan /orders, 100 qator) faqat ko'rinadigan qatorlar va
 * ozgina zaxira DOM'da turadi: 100 qatorda ~7 100 tugun va har qayta chizishda ~136 ms edi.
 *
 *  - Skroll konteyneri — ro'yxatning eng yaqin vertikal skroll qiluvchi ajdodi (shell'da `<main>`); topilmasa — hujjat.
 *  - Ro'yxat boshi (`anchorRef`: `<tbody>` / `<ul>`) konteynerdagi o'rni (`scrollMargin`) o'lchanadi va kontent
 *    o'lchami o'zgarsa (filtr paneli ochildi) qayta hisoblanadi.
 *  - Qator balandligi taxminiy (`estimateSize`), chizilgach haqiqiysi o'lchanadi (`measureElement`, `data-index`).
 *  - Skroll uzunligi o'zgarmaydi: ko'rinmas qatorlar o'rni yuqori/pastki bo'sh joy (`paddingTop`/`paddingBottom`).
 */
const OVERSCAN = 5;
/** Konteyner hali o'lchanmagan birinchi chizishda — shuncha qator (hammasi emas). */
const FIRST_PAINT_ROWS = 20;

/**
 * Haqiqatan vertikal aylanadigan eng yaqin ajdod. Faqat `overflow-y` ga qaralmaydi: `overflow-x: auto` (jadval o'rami)
 * CSS bo'yicha `overflow-y` ni ham `auto` qiladi, lekin u vertikal aylanmaydi — shuning uchun kontent sig'magani ham shart.
 */
const scrollParentOf = (node: HTMLElement | null): HTMLElement | null => {
  for (let element = node?.parentElement ?? null; element; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element);
    if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) return element;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
};

export type VirtualRows = {
  /** Chiziladigan qatorlar (indeks — `rows` dagi). */
  items: readonly Pick<VirtualItem, "index" | "key">[];
  paddingTop: number;
  paddingBottom: number;
  /** Har chizilgan qatorga `ref` (`data-index` bilan) — haqiqiy balandlik. */
  measureElement: (node: Element | null) => void;
};

export const useVirtualRows = ({
  count,
  enabled,
  estimateSize,
  anchorRef,
}: {
  count: number;
  enabled: boolean;
  estimateSize: number;
  anchorRef: RefObject<HTMLElement | null>;
}): VirtualRows | null => {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const anchor = anchorRef.current;
    const scroller = scrollParentOf(anchor);
    setScrollElement(scroller);
    if (!anchor || !scroller) return undefined;
    const update = () => {
      const margin =
        anchor.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      setScrollMargin((previous) => (Math.abs(previous - margin) < 1 ? previous : margin));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller.firstElementChild ?? scroller);
    return () => observer.disconnect();
  }, [anchorRef, enabled]);

  const virtualizer = useVirtualizer({
    count: enabled ? count : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    overscan: OVERSCAN,
    scrollMargin,
    enabled: enabled && scrollElement !== null,
  });

  if (!enabled) return null;

  const virtualItems = virtualizer.getVirtualItems();
  if (!scrollElement || virtualItems.length === 0) {
    const shown = Math.min(count, FIRST_PAINT_ROWS);
    return {
      items: Array.from({ length: shown }, (_, index) => ({ index, key: index })),
      paddingTop: 0,
      paddingBottom: (count - shown) * estimateSize,
      measureElement: virtualizer.measureElement,
    };
  }

  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];
  return {
    items: virtualItems,
    paddingTop: Math.max(0, first.start - scrollMargin),
    paddingBottom: Math.max(0, virtualizer.getTotalSize() - (last.end - scrollMargin)),
    measureElement: virtualizer.measureElement,
  };
};
