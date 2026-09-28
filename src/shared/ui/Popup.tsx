import { memo, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";

interface Props {
  children: ReactNode;
  onClose?: () => void;
  isShow?: boolean;
  img?: File;
  /** Oyna sarlavhasi elementining `id`si — skrinrider oynani shu nom bilan o'qiydi. */
  labelledBy?: string;
  /** Ko'rinadigan sarlavha bo'lmasa — oyna nomi. */
  ariaLabel?: string;
}

const Popup: FC<Props> = ({ children, onClose, isShow = false, labelledBy, ariaLabel }) => {
  // Oyna `body` ga portal qilinadi — ochiq turganda ilova (`#root`) `inert`.
  const panelRef = useFocusTrap<HTMLDivElement>(isShow, { onEscape: onClose, inertAppRoot: true });

  if (!isShow) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        // Fon tugmasi faqat sichqoncha uchun — Tab'da to'xtamaydi (Escape bor).
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-[9998] h-screen w-full cursor-default bg-black/65 backdrop-blur-md"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 outline-none"
      >
        {children}
      </div>
    </>,
    document.body,
  );
};

export default memo(Popup);
