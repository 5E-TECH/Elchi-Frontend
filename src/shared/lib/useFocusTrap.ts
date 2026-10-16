/**
 * FOKUS QAMOG'I — eski import yo'li (shell, v1 `Popup` va sahifa oynalari shu yerdan oladi).
 *
 * Amalga oshirish dizayn v2 overlay infratuzilmasida: `shared/ui/primitives/overlay/useFocusTrap`.
 * Bitta qatlam steki (`layerStack`) — eski oyna ustida yangi dialog yoki ro'yxat ochilsa,
 * Esc faqat eng ustdagisini yopadi. API o'zgarmagan: `useFocusTrap(active, { onEscape, inertAppRoot })`.
 * Yangi kodda to'g'ridan-to'g'ri `shared/ui/primitives` dan oling (`inert`, `initialFocus`, `returnFocus` bilan).
 */
export { getFocusableElements } from "../ui/primitives/overlay/focusable";
export { useFocusTrap } from "../ui/primitives/overlay/useFocusTrap";
export type { FocusTrapOptions } from "../ui/primitives/overlay/useFocusTrap";
