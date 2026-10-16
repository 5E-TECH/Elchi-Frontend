import { useCallback, useId, useRef, useState } from "react";
import { useDismiss } from "../overlay/useDismiss";
import { useFocusTrap } from "../overlay/useFocusTrap";
import { usePopover } from "../overlay/usePopover";
import { useScrollLock } from "../overlay/useScrollLock";
import { useIsPhone } from "./useIsPhone";

export type DatePickerState = ReturnType<typeof useDatePicker>;

/**
 * Ochish/yopish:
 *   desktop — modal emas (`role="dialog"`, maketdagidek `aria-modal` siz): Esc va tashqariga bosish
 *             yopadi (`useDismiss`), Tab panel ichida aylanadi, tanlov yoki Esc dan keyin fokus maydonga;
 *   telefon — modal pastki varaqa: fon `inert`, skroll qulfi, fokus qamog'i, Esc yoki fon — yopadi,
 *             yopilganda fokus maydonga (`useFocusTrap`).
 */
export const useDatePicker = () => {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { anchorRef, floatingRef, floatingStyles, side } = usePopover<HTMLDivElement, HTMLDivElement>({
    open: open && !phone,
    placement: "bottom-start",
  });

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      // Telefonda fokusni `useFocusTrap` qaytaradi (`inert` olingandan keyin).
      if (returnFocus && !phone) triggerRef.current?.focus({ preventScroll: true });
    },
    [phone],
  );

  useDismiss({
    open: open && !phone,
    refs: [anchorRef, floatingRef],
    onDismiss: (reason) => close(reason === "escape"),
  });
  const sheetRef = useFocusTrap<HTMLDivElement>(open && phone, { onEscape: () => close(true), inert: true });
  useScrollLock(open && phone);

  // O'chirilgan maydon tugmasi `disabled` (bosilmaydi) — bu yerda alohida tekshiruv kerak emas.
  const toggle = () => setOpen((value) => !value);

  return { phone, open, setOpen, toggle, close, triggerRef, panelId, anchorRef, floatingRef, floatingStyles, side, sheetRef };
};
