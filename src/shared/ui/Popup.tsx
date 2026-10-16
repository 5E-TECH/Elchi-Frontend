import { memo, useId, useLayoutEffect, useRef, type FC, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { Portal, useFocusTrap, usePresence, useScrollLock, type Presence } from "./primitives";
import { AntdLayer } from "./primitives/dialog/AntdLayer";
import { useBackdropPress } from "./primitives/dialog/useBackdropPress";

interface Props {
  children: ReactNode;
  onClose?: () => void;
  isShow?: boolean;
  img?: File;
  /**
   * Oyna sarlavhasi elementining `id`si — skrinrider oynani shu nom bilan o'qiydi. Ikkalasi ham berilmasa,
   * nom paneldagi birinchi sarlavhadan (`h1`–`h6`) olinadi.
   */
  labelledBy?: string;
  /** Ko'rinadigan sarlavha (`h1`–`h6`) bo'lmasa — oyna nomi. */
  ariaLabel?: string;
}

/**
 * ESKI (v1) OYNA O'RAMI — API o'zgarmagan, ichi dizayn v2 overlay infratuzilmasida (3-bosqich).
 *
 * Panelni chaqiruvchi o'zi chizadi (`children` — v1 karta); bu yerda faqat modal xatti-harakati va
 * v2 fon: `Portal` (`overlay` qatlami, 1200), `bg-overlay` (blur yo'q), fokus qamog'i + `inert`,
 * Esc va fon bosilsa yopiladi, orqa fon aylanmaydi, yopilgach fokus ochgan tugmaga qaytadi,
 * ochilish/yopilish harakati (`tizim-motion` 03).
 *
 * Panel markazda (telefonda ham): v1 panellari varaqa sifatida chizilmagan. Baland panel sahifa
 * ichida aylanadi (avval tepasi kesilardi). Yangi kodda `Dialog` / `ConfirmDialog` ishlating — ular
 * telefonda pastki varaqa bo'ladi.
 */
const ROOT = "fixed inset-0 flex overflow-y-auto overscroll-contain p-6 max-md:p-0";

const BACKDROP =
  "pointer-events-none fixed inset-0 bg-overlay transition-opacity duration-250 ease-[cubic-bezier(0.2,0,0,1)] " +
  "starting:opacity-0 data-[state=closed]:opacity-0 data-[state=closed]:duration-200 " +
  "data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] motion-reduce:transition-none";

const PANEL =
  "relative m-auto max-w-full outline-none transition-[opacity,scale] duration-250 " +
  "ease-[cubic-bezier(0.2,0,0,1)] starting:scale-[.98] starting:opacity-0 data-[state=closed]:scale-[.98] " +
  "data-[state=closed]:opacity-0 data-[state=closed]:duration-200 data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] " +
  "motion-reduce:transition-none";

type PopupModalProps = Omit<Props, "isShow" | "img"> & { open: boolean; presence: Presence };

/** Sarlavha elementi (oyna nomi uchun): birinchi `h1`–`h6` yoki `role="heading"`. */
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, [role='heading']";

const PopupModal = ({ open, presence, onClose, labelledBy, ariaLabel, children }: PopupModalProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const fallbackTitleId = useId();
  const panelRef = useFocusTrap<HTMLDivElement>(open, {
    onEscape: () => {
      if (open) onClose?.();
    },
    inert: true,
  });

  // Oyna nomi (WAI-ARIA dialog): chaqiruvchi `labelledBy` / `ariaLabel` bermasa — paneldagi birinchi
  // sarlavha (`id` siz bo'lsa beriladi). Har chizishda: sarlavha keyinroq paydo bo'lishi mumkin.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || labelledBy) return;
    const heading = ariaLabel ? null : panel.querySelector<HTMLElement>(HEADING_SELECTOR);
    if (!heading) {
      panel.removeAttribute("aria-labelledby");
      return;
    }
    if (!heading.id) heading.id = fallbackTitleId;
    panel.setAttribute("aria-labelledby", heading.id);
  });
  useScrollLock(open);
  const state = presence.exiting ? "closed" : "open";

  // Fon bosilsa yopiladi — oyna eng ustda bo'lsa (ichidagi ro'yxat ochiq turganda faqat ro'yxat yopiladi).
  const backdrop = useBackdropPress(open, rootRef, () => {
    if (!open || !onClose) return false;
    onClose();
    return true;
  });

  return (
    <Portal layer="overlay">
      <div aria-hidden="true" data-state={state} className={BACKDROP} />
      {/* Fon bosilishi sichqoncha/teginish uchun; klaviaturada Esc bor. */}
      <div
        ref={rootRef}
        data-popup-root=""
        data-state={state}
        inert={presence.exiting}
        onPointerDown={backdrop.onPointerDown}
        onClick={backdrop.onClick}
        className={cx(ROOT, presence.exiting && "pointer-events-none")}
      >
        <AntdLayer>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
            tabIndex={-1}
            data-state={state}
            onTransitionEnd={(event) => {
              if (presence.exiting && event.target === event.currentTarget) presence.finish();
            }}
            className={PANEL}
          >
            {children}
          </div>
        </AntdLayer>
      </div>
    </Portal>
  );
};

const Popup: FC<Props> = ({ children, onClose, isShow = false, labelledBy, ariaLabel }) => {
  const presence = usePresence(isShow);
  if (!presence.mounted) return null;
  return (
    <PopupModal open={isShow} presence={presence} onClose={onClose} labelledBy={labelledBy} ariaLabel={ariaLabel}>
      {children}
    </PopupModal>
  );
};

export default memo(Popup);
