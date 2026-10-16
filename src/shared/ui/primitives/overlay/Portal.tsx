import { useInsertionEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { getStackingZ, LayerContext, useParentLayerZ, Z_LAYERS, type PortalLayer } from "./layers";
import { getPortalRoot, LAYER_ATTR } from "./portalRoot";

export type PortalProps = {
  children: ReactNode;
  /** Qatlam (`tizim-motion` 08): `dropdown` 1000 · `overlay` 1200 · `toast` 1300. */
  layer: PortalLayer;
  /**
   * Langar — portal shu element turgan qatlamdan PAST tushmaydi (o'tish davri: eski v1 oyna
   * `z-[9998]` yoki antd `Modal` ichida ochilgan ro'yxat ularning ostida qolmasin).
   *   - `RefObject` — ro'yxat/kalendar tugmasi (`usePopover` → `anchorRef`);
   *   - `"active"` — ochilish paytidagi fokusdagi element (oynani ochgan tugma).
   * Sukut: `overlay` uchun `"active"`, qolganlarida yo'q.
   */
  anchor?: RefObject<Element | null> | "active" | null;
};

/**
 * PORTAL — v2 qatlamlarini yagona `#ui-portal` ildiziga chiqaradi.
 *
 *   <Portal layer="dropdown" anchor={anchorRef}>
 *     <div ref={floatingRef} style={floatingStyles}>…</div>
 *   </Portal>
 *
 * Har portal o'z konteynerini oladi: `<div data-ui-layer="dropdown" style="position:relative;z-index:1000">`.
 * Konteyner `useInsertionEffect` da ulanadi — bolalarning `useLayoutEffect` lari (o'lchash, fokus)
 * ishlaganda u allaqachon hujjatda turadi. Yopilganda konteyner olib tashlanadi.
 *
 * Ichma-ich portal (dialog ichidagi ro'yxat) ota qatlamidan bitta yuqori turadi (oyna 1200 →
 * ichidagi ro'yxat 1201), xabar qatlami (1300) esa baribir ustda.
 */
export const Portal = ({ children, layer, anchor = layer === "overlay" ? "active" : null }: PortalProps) => {
  const parentZ = useParentLayerZ();
  // Ichma-ich portal ota qatlamdan QAT'IY yuqori: bir commit'da ochilganda ichki konteyner DOM'ga
  // otadan oldin qo'shiladi (bolalar effekti avval), shuning uchun tartibga tayanib bo'lmaydi.
  const z = parentZ > 0 ? Math.max(Z_LAYERS[layer], parentZ + 1) : Z_LAYERS[layer];
  const [container] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  // Ochilish paytidagi fokus — oynani ochgan tugma (keyin fokus oyna ichiga ko'chadi).
  const [opener] = useState<Element | null>(() =>
    anchor === "active" && typeof document !== "undefined" ? document.activeElement : null,
  );

  useInsertionEffect(() => {
    if (!container) return;
    container.setAttribute(LAYER_ATTR, layer);
    container.style.position = "relative";
    getPortalRoot().appendChild(container);
    return () => {
      container.remove();
    };
  }, [container, layer]);

  useInsertionEffect(() => {
    if (!container) return;
    const anchorElement = anchor === "active" ? opener : (anchor?.current ?? null);
    const anchorZ = anchorElement && !container.contains(anchorElement) ? getStackingZ(anchorElement) : 0;
    container.style.zIndex = String(anchorZ >= z ? anchorZ + 1 : z);
  });

  if (!container) return null;
  return createPortal(<LayerContext.Provider value={z}>{children}</LayerContext.Provider>, container);
};
