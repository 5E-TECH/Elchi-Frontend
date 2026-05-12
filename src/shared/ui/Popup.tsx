import { memo, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  children: ReactNode;
  onClose?: () => void;
  isShow?: boolean;
  img?: File
}

const Popup: FC<Props> = ({ children, onClose, isShow = false }) => {
  if (!isShow) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[9998] h-screen w-full bg-black/65 backdrop-blur-md"
      />

      <div className="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2">
        {children}
      </div>
    </>,
    document.body,
  );
};

export default memo(Popup);
