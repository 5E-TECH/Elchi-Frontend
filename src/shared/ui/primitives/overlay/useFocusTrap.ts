import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { getFocusableElements } from "./focusable";
import { hasOpenForeignPopup } from "./foreignPopups";
import { inertOthers } from "./inert";
import { isTopLayer, pushLayer, removeLayer } from "./layerStack";
import { LAYER_ATTR } from "./portalRoot";

export type FocusTrapOptions = {
  /** Esc bosilganda (odatda oynani yopish). Berilmasa Esc ushlanmaydi. Faqat eng ustdagi qatlamda. */
  onEscape?: () => void;
  /**
   * Ochilganda fokus qayerga:
   *   - `"first"` (sukut) — paneldagi birinchi fokuslanuvchi element (bo'lmasa panelning o'zi);
   *   - `"panel"` — panelning o'zi (`tabIndex={-1}`; uzun matnli oyna — ekran o'quvchi sarlavhani o'qiydi);
   *   - `RefObject` — aniq element (tasdiqlash oynasida xavfsiz «Bekor qilish», `tizim-motion` 03).
   * Fokus allaqachon panel ichida bo'lsa (masalan `autoFocus`) — tegilmaydi.
   */
  initialFocus?: "first" | "panel" | RefObject<HTMLElement | null>;
  /**
   * Yopilganda fokus qayerga qaytadi: `true` (sukut) — ochilishdan oldingi fokus (oynani ochgan
   * tugma); `false` — qaytarilmaydi; `RefObject` — aniq element (ochgan tugma o'chib ketgan bo'lsa).
   */
  returnFocus?: boolean | RefObject<HTMLElement | null>;
  /**
   * Modal: oyna qatlamidan (`[data-ui-layer]` konteyner, bo'lmasa panel) tashqaridagi hamma narsa
   * `inert` (`inertOthers`) — `#root`, eski portallar, boshqa qatlamlar; xabarlar (`toast`) bundan mustasno.
   */
  inert?: boolean;
  /**
   * ESKI (`shared/lib/useFocusTrap`): faqat `#root` ni `inert` qiladi (panel `#root` dan tashqarida bo'lsa).
   * Yangi kodda `inert` ishlating.
   */
  inertAppRoot?: boolean;
};

/**
 * FOKUS QAMOG'I — modal oyna, pastki varaqa, telefon menyusi (WAI-ARIA dialog naqshi).
 *
 *   const panelRef = useFocusTrap<HTMLDivElement>(open, { onEscape: close, inert: true, initialFocus: cancelRef });
 *   <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}>…</div>
 *
 * `active` bo'lganda: avvalgi fokus eslab qolinadi, fokus panel ichiga ko'chadi (`initialFocus`),
 * Tab / Shift+Tab panel ichida aylanadi, Esc — `onEscape` (faqat eng ustdagi qatlamda, `layerStack`).
 * Yopilganda (yoki `active=false`) fokus ochgan elementga qaytadi.
 *
 * ⚠️ `focusin` bilan fokus majburan qaytarilmaydi: oyna ichidagi antd Select/DatePicker ro'yxati
 * `body` ga portal qilinadi va unga bosish fokusni panel tashqarisiga chiqaradi — qaytarish ro'yxatni
 * yopardi. Tashqarida turgan fokus keyingi Tab'da panelga qaytadi.
 * Bubble fazasi va `defaultPrevented`: ichidagi maydon Esc ni o'zi ishlatsa (qidiruvni tozalash,
 * antd ro'yxatini yopish) — oyna yopilmaydi.
 */
export const useFocusTrap = <T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  { onEscape, initialFocus = "first", returnFocus = true, inert = false, inertAppRoot = false }: FocusTrapOptions = {},
): RefObject<T | null> => {
  const panelRef = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const initialFocusRef = useRef(initialFocus);
  const returnFocusRef = useRef(returnFocus);

  // Avvalgi fokus `inert` qo'yilishidan OLDIN olinadi: inert ichidagi element fokusni yo'qotadi
  // va keyin `document.activeElement` endi body bo'lardi.
  useLayoutEffect(() => {
    if (!active) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [active]);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    initialFocusRef.current = initialFocus;
    returnFocusRef.current = returnFocus;
  });

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;

    const token = pushLayer("focus-trap", () => [panel]);
    const previous = previousFocusRef.current;

    let restoreInert: (() => void) | null = null;
    if (inert) {
      restoreInert = inertOthers(panel.closest(`[${LAYER_ATTR}]`) ?? panel);
    } else if (inertAppRoot) {
      const appRoot = document.getElementById("root");
      if (appRoot && !appRoot.contains(panel)) restoreInert = inertOthers(panel, { targets: [appRoot] });
    }

    if (!panel.contains(document.activeElement)) {
      const target = initialFocusRef.current;
      const element =
        target === "panel"
          ? panel
          : target === "first"
            ? (getFocusableElements(panel)[0] ?? panel)
            : (target.current ?? getFocusableElements(panel)[0] ?? panel);
      element.focus({ preventScroll: true });
    }

    // Esc paytida ochiq antd paneli bormi — capture fazasida (antd o'zini yopishidan OLDIN), `foreignPopups.ts`.
    let escapeForForeignPopup = false;
    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") escapeForForeignPopup = hasOpenForeignPopup();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopLayer(token) || event.defaultPrevented || event.isComposing) return;

      if (event.key === "Escape") {
        // antd ro'yxati/kalendari ochiq — Esc unga tegishli: oyna yopilmaydi va hodisa to'xtatilmaydi
        // (`Dropdown` Esc ni `window` da tinglaydi).
        if (!onEscapeRef.current || escapeForForeignPopup) return;
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const items = getFocusableElements(panel);
      const current = document.activeElement;
      if (items.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const outside = !panel.contains(current);
      if (event.shiftKey && (outside || current === first || current === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || current === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDownCapture, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDownCapture, true);
      document.removeEventListener("keydown", handleKeyDown);
      removeLayer(token);
      // Tartib muhim: avval `inert` olinadi, keyin fokus qaytariladi — inert ichidagi elementga
      // fokus qo'yib bo'lmaydi.
      restoreInert?.();
      const back = returnFocusRef.current;
      if (back === false) return;
      const target = back === true ? previous : (back.current ?? previous);
      if (target && target.isConnected) target.focus({ preventScroll: true });
    };
  }, [active, inert, inertAppRoot]);

  return panelRef;
};
