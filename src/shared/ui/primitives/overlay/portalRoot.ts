/**
 * Barcha v2 qatlamlari (ro'yxat, dialog, xabar) uchun YAGONA portal ildizi: `<div id="ui-portal">`
 * `body` oxirida. Ildizning o'zi pozitsiyalanmagan va `z-index`siz — ichidagi har portal
 * konteyneri o'z qatlami bilan (`Z_LAYERS`) ildiz kontekstida raqobatlashadi.
 *
 * `#root` dan tashqarida: modal ochilganda ilova (`#root`) va boshqa qatlamlar `inert` bo'ladi,
 * oynaning o'zi esa yo'q (`inertOthers`).
 */
export const PORTAL_ROOT_ID = "ui-portal";

/** `#ui-portal` ni topadi, yo'q bo'lsa `body` oxiriga qo'shadi. */
export const getPortalRoot = (): HTMLElement => {
  const existing = document.getElementById(PORTAL_ROOT_ID);
  if (existing) return existing;
  const root = document.createElement("div");
  root.id = PORTAL_ROOT_ID;
  document.body.appendChild(root);
  return root;
};

/** Portal konteyneri belgisi: `data-ui-layer="dropdown|overlay|toast"`. */
export const LAYER_ATTR = "data-ui-layer";

/**
 * Hodisa nishoni v2 qatlamidami (`#ui-portal`: ro'yxat, kalendar, dialog, varaqa, xabar).
 *
 * O'TISH DAVRI: eski (v1) sahifalarning `document` `mousedown` «tashqariga bosish» tinglovchilari (telefon
 * filtr paneli, tablar menyusi) panel ichidan ochilgan portal ro'yxati yoki kalendarini «tashqari» deb bilib,
 * panelni birinchi bosishdayoq yopardi. Ular shu tekshiruv bilan portal ichidagi bosishni o'tkazib yuboradi:
 *
 *   if (isInUiLayer(event.target)) return;
 */
export const isInUiLayer = (target: EventTarget | null): boolean => {
  if (typeof document === "undefined" || !(target instanceof Node)) return false;
  const root = document.getElementById(PORTAL_ROOT_ID);
  return Boolean(root?.contains(target));
};
