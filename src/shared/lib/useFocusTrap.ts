import { useEffect, useLayoutEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Panel ichidagi, hozir ko'rinib turgan fokuslanuvchi elementlar (DOM tartibida). */
export const getFocusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      // `tabIndex={-1}` (masalan fon tugmasi) — Tab'da to'xtamaydi.
      element.tabIndex >= 0 &&
      !element.closest("[inert], [aria-hidden='true']") &&
      // `display: none` (masalan `hidden md:flex`) elementlar Tab'da to'xtamaydi.
      (typeof element.checkVisibility === "function" ? element.checkVisibility() : true),
  );

/**
 * Bir vaqtda bir nechta oyna ochiq bo'lishi mumkin (masalan oyna ichidan
 * tasdiq oynasi). Klaviaturani faqat ENG USTDAGI qamoq boshqaradi — aks holda
 * pastdagi oyna fokusni ustdagidan tortib olardi.
 */
const trapStack: symbol[] = [];

/** `#root` ni `inert` qilgan ochiq oynalar soni (ichma-ich oynalar uchun). */
let inertRootCount = 0;

type FocusTrapOptions = {
  /** Escape bosilganda (odatda oynani yopish). Berilmasa Escape ushlanmaydi. */
  onEscape?: () => void;
  /**
   * `true` — panel `#root` dan TASHQARIDA (body'ga portal): ochiq turganda
   * butun ilova `inert` bo'ladi, orqa fon Tab'dan ham, skrinriderdan ham
   * chiqib ketadi.
   */
  inertAppRoot?: boolean;
};

/**
 * FOKUS QAMOG'I — modal oyna va mobil menyu uchun.
 *
 * `active` bo'lganda: avvalgi fokus eslab qolinadi, fokus panel ichidagi
 * birinchi elementga (bo'lmasa panelning o'ziga) ko'chadi, Tab / Shift+Tab
 * panel ichida aylanadi, Escape — `onEscape`. Yopilganda fokus chaqiruvchi
 * elementga qaytadi.
 *
 * Panel elementiga qaytarilgan `ref` ulanadi; panel fokus ola olishi uchun
 * unga `tabIndex={-1}` berilsin.
 */
export const useFocusTrap = <T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  { onEscape, inertAppRoot = false }: FocusTrapOptions = {},
) => {
  const panelRef = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Avvalgi fokus `inert` qo'yilishidan OLDIN olinadi: inert ichidagi element
  // fokusni yo'qotadi va keyin `document.activeElement` endi body bo'lardi.
  useLayoutEffect(() => {
    if (!active) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [active]);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;

    const token = Symbol("focus-trap");
    trapStack.push(token);
    const isTopmost = () => trapStack[trapStack.length - 1] === token;

    const previous = previousFocusRef.current;
    const appRoot = inertAppRoot ? document.getElementById("root") : null;
    const madeInert = Boolean(appRoot && !appRoot.contains(panel));
    if (appRoot && madeInert) {
      inertRootCount += 1;
      appRoot.setAttribute("inert", "");
    }
    if (!panel.contains(document.activeElement)) {
      (getFocusableElements(panel)[0] ?? panel).focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost() || event.defaultPrevented) return;

      if (event.key === "Escape") {
        if (!onEscapeRef.current) return;
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

    // ⚠️ `focusin` bilan fokus majburan qaytarilmaydi: oyna ichidagi antd
    // Select/DatePicker ro'yxati body'ga portal qilinadi va unga bosish fokusni
    // panel tashqarisiga olib chiqadi — qaytarish ro'yxatni yopib qo'yardi.
    // Tashqarida turgan fokus keyingi Tab'da panelga qaytadi (yuqorida).
    // Bubble fazasi: oyna ichidagi antd ro'yxati Escape'ni o'zi ushlasa
    // (`preventDefault`), faqat ro'yxat yopiladi — butun oyna emas.
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = trapStack.indexOf(token);
      if (index !== -1) trapStack.splice(index, 1);
      // Tartib muhim: avval `inert` olinadi, keyin fokus qaytariladi —
      // inert ichidagi elementga fokus qo'yib bo'lmaydi.
      if (appRoot && madeInert) {
        inertRootCount = Math.max(0, inertRootCount - 1);
        if (inertRootCount === 0) appRoot.removeAttribute("inert");
      }
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, inertAppRoot]);

  return panelRef;
};
