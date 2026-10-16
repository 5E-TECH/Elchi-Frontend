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

/** Panel ichidagi, hozir ko'rinib turgan, Tab'da to'xtaydigan elementlar (DOM tartibida). */
export const getFocusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      // `tabIndex={-1}` (masalan fon tugmasi) — Tab'da to'xtamaydi.
      element.tabIndex >= 0 &&
      !element.closest("[inert], [aria-hidden='true']") &&
      // `display: none` (masalan `hidden md:flex`) elementlar Tab'da to'xtamaydi.
      (typeof element.checkVisibility === "function" ? element.checkVisibility() : true),
  );
