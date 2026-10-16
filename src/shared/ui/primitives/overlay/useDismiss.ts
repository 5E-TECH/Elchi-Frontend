import { useEffect, useRef, type RefObject } from "react";
import { isTopLayer, pushLayer, removeLayer } from "./layerStack";
import { LAYER_ATTR, PORTAL_ROOT_ID } from "./portalRoot";

export type DismissReason = "escape" | "outside" | "focus";

export type UseDismissOptions = {
  /** Ochiq bo'lgandagina tinglaydi va qatlam stekiga kiradi. */
  open: boolean;
  /** Yopish so'raldi: `escape` — Esc; `outside` — tashqariga bosildi; `focus` — fokus tashqariga chiqdi. */
  onDismiss: (reason: DismissReason, event: Event) => void;
  /**
   * «Ichkari» hisoblanadigan elementlar — odatda langar (trigger) va suzuvchi panel
   * (`[anchorRef, floatingRef]` — `usePopover` dan). Langarga bosish tashqari EMAS — uni trigger
   * o'zi boshqaradi (ochiq ro'yxat tugmasi qayta bosilsa yopiladi).
   */
  refs: ReadonlyArray<RefObject<Element | null>>;
  /** Esc bilan yopish (sukut `true`). Faqat eng ustdagi qatlamda; maydon Esc ni o'zi ishlatsa (`defaultPrevented`) — yo'q. */
  escape?: boolean;
  /** Tashqariga bosish (`pointerdown`) bilan yopish (sukut `true`). Faqat eng ustdagi qatlamda. */
  outsidePress?: boolean;
  /** Fokus (Tab) ichkaridan tashqariga chiqsa yopish (sukut `false`; combobox/ro'yxat uchun `true`). */
  focusOutside?: boolean;
};

/**
 * Uchinchi tomon suzuvchi panellari (o'tish davri: v2 dialog ichidagi antd Select/DatePicker ro'yxati
 * `body` ga portal qilinadi) va `data-ui-dismiss-ignore` belgili elementlar — ularga bosish «tashqari» emas.
 */
const IGNORE_SELECTOR = [
  "[data-ui-dismiss-ignore]",
  ".ant-select-dropdown",
  ".ant-picker-dropdown",
  ".ant-dropdown",
  ".ant-popover",
  ".ant-tooltip",
  ".ant-message",
  ".ant-notification",
].join(",");

/**
 * `target` shu qatlamdan YUQORI portal qatlamida turadimi (masalan ro'yxat ichidan ochilgan ichki menyu
 * yoki xabar) — u ham «tashqari» emas. Yuqori = katta z-index, teng bo'lsa DOM'da keyin.
 */
const isInLaterLayer = (target: Element, ownContainer: Element | null) => {
  const layer = target.closest<HTMLElement>(`#${PORTAL_ROOT_ID} > [${LAYER_ATTR}]`);
  if (!layer || layer === ownContainer) return false;
  if (!(ownContainer instanceof HTMLElement)) return true;
  const own = Number(ownContainer.style.zIndex) || 0;
  const other = Number(layer.style.zIndex) || 0;
  if (other !== own) return other > own;
  return Boolean(ownContainer.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING);
};

/**
 * YOPISH — ro'yxat, menyu, kalendar, popover uchun: Esc va tashqariga bosish (WAI-ARIA combobox/menu).
 *
 *   const { anchorRef, floatingRef, floatingStyles } = usePopover({ open });
 *   useDismiss({ open, refs: [anchorRef, floatingRef], onDismiss: () => setOpen(false) });
 *
 * Qatlam stekida turadi (`layerStack`): dialog ichidagi ochiq ro'yxat Esc'da faqat o'zi yopiladi.
 * Modal dialog uchun `useFocusTrap({ onEscape })` + fon bosilishi ishlatiladi, bu hook emas.
 */
export const useDismiss = ({
  open,
  onDismiss,
  refs,
  escape = true,
  outsidePress = true,
  focusOutside = false,
}: UseDismissOptions) => {
  const onDismissRef = useRef(onDismiss);
  const refsRef = useRef(refs);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!open) return;
    const elements = () => refsRef.current.map((ref) => ref.current).filter((el): el is Element => Boolean(el));
    // Qatlam darajasi — langar va paneldan eng yuqorisi (ro'yxat paneli o'z portal qatlamida).
    const token = pushLayer("dismiss", elements);
    const isInside = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const inside = elements();
      if (inside.some((el) => el.contains(target))) return true;
      if (target.closest(IGNORE_SELECTOR)) return true;
      const ownContainer = inside.map((el) => el.closest(`[${LAYER_ATTR}]`)).find(Boolean) ?? null;
      return isInLaterLayer(target, ownContainer);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!escape || event.key !== "Escape") return;
      if (!isTopLayer(token) || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      onDismissRef.current("escape", event);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!outsidePress || !isTopLayer(token)) return;
      const target = event.target;
      // Bosish paytida DOM'dan olib tashlangan element (masalan tanlangan variant) — tashqari emas.
      if (target instanceof Node && !target.isConnected) return;
      if (isInside(target)) return;
      onDismissRef.current("outside", event);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!focusOutside || isInside(event.target)) return;
      onDismissRef.current("focus", event);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      removeLayer(token);
    };
  }, [open, escape, outsidePress, focusOutside]);
};
