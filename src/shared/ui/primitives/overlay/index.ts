/**
 * OVERLAY INFRATUZILMASI — dizayn v2, 3-bosqich (Select, DateRange, Dialog, Toaster shu ustida).
 *
 *   Portal          — yagona `#ui-portal` ildiziga, qatlam bilan (`Z_LAYERS`: dropdown 1000 · overlay 1200 · toast 1300)
 *   usePopover      — langarga nisbatan joylashuv: flip / shift, eni maydonga teng, skroll va o'lchamda yangilanadi
 *   useDismiss      — Esc + tashqariga bosish (+ fokus chiqishi), faqat eng ustdagi qatlamda
 *   useFocusTrap    — fokus qamog'i, boshlang'ich fokus, yopilganda qaytarish, Esc, `inert`
 *   useScrollLock   — orqa fon skrolli qulfi (hisoblagichli)
 *   inertOthers     — oynadan tashqarini `inert` qilish (hisoblagichli); `useInertOthers` — hook
 *   shellInset      — telefon pastki menyusi balandligi `:root` da (`--shell-bottom-inset`), popover uni chetlaydi
 *   isInUiLayer     — hodisa v2 qatlamida bo'ldimi (eski sahifa «tashqariga bosish» tinglovchilari uchun)
 *   useVisualViewportFit — telefon klaviaturasi ochiqligida ko'rinadigan oyna (varaqa klaviatura ustida turishi uchun)
 */
export { Portal } from "./Portal";
export type { PortalProps } from "./Portal";
export { getStackingZ, LayerContext, useParentLayerZ, Z_LAYERS } from "./layers";
export type { PortalLayer } from "./layers";
export { getPortalRoot, isInUiLayer, LAYER_ATTR, PORTAL_ROOT_ID } from "./portalRoot";
export {
  readShellBottomInset,
  SHELL_BOTTOM_INSET_VAR,
  useShellBottomInsetSource,
  writeShellBottomInset,
} from "./shellInset";
export { getOpenLayerCount, isTopLayer, pushLayer, removeLayer } from "./layerStack";
export { getFocusableElements } from "./focusable";
export { useFocusTrap } from "./useFocusTrap";
export type { FocusTrapOptions } from "./useFocusTrap";
export { useDismiss } from "./useDismiss";
export type { DismissReason, UseDismissOptions } from "./useDismiss";
export { useScrollLock } from "./useScrollLock";
export { inertOthers, useInertOthers } from "./inert";
export { computePopoverPosition, usePopover } from "./usePopover";
export type {
  PopoverAlign,
  PopoverPlacement,
  PopoverPosition,
  PopoverPositionInput,
  PopoverSide,
  UsePopoverOptions,
  UsePopoverResult,
} from "./usePopover";
export { assignRefs, useMergedRefs } from "./mergeRefs";
export { useVisualViewportFit } from "./useVisualViewportFit";
export type { VisualViewportFit } from "./useVisualViewportFit";
