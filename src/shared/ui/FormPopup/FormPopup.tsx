import { memo, type ReactNode, type FormEventHandler } from "react";
import { X } from "lucide-react";
import Popup from "../Popup";
import Button from "../../components/button";
import styles from "./FormPopup.module.css";

interface FormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  title: string;
  description?: string;
  icon?: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  children: ReactNode;
  widthClassName?: string;
}

export const popupLabelClassName = styles.label;
export const popupFormClassName = styles.form;

const FormPopup = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  icon,
  submitLabel = "Saqlash",
  cancelLabel = "Bekor qilish",
  isLoading = false,
  children,
  widthClassName = "max-w-2xl",
}: FormPopupProps) => {
  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <form
        onSubmit={onSubmit}
        className={`${styles.panel} flex max-h-[90vh] w-[92vw] ${widthClassName} flex-col overflow-hidden rounded-[1.75rem]`}
      >
        <div className={`${styles.header} flex items-start justify-between gap-4 border-b border-[color:var(--color-border-soft)] px-6 py-5`}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-white shadow-[0_16px_30px_rgba(87,106,219,0.28)]">
              {icon}
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-[var(--color-maindark)] dark:text-white">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 text-[var(--color-maindark)] transition-colors hover:bg-[var(--color-main-soft)] dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`${styles.body} ${styles.form} custom-scrollbar flex-1 overflow-y-auto px-6 py-5`}>
          {children}
        </div>

        <div className={`${styles.footer} flex gap-3 border-t border-[color:var(--color-border-soft)] px-6 py-5`}>
          <Button
            type="button"
            label={cancelLabel}
            onClick={onClose}
            className="flex-1 !bg-transparent !text-[var(--color-maindark)] !shadow-none border border-[color:var(--color-border-soft)] hover:!bg-[var(--color-main-soft)] dark:!text-white/85 dark:hover:!bg-white/10"
          />
          <Button
            type="submit"
            label={isLoading ? "Saqlanmoqda..." : submitLabel}
            disabled={isLoading}
            className="flex-1 !bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] hover:opacity-95"
          />
        </div>
      </form>
    </Popup>
  );
};

export default memo(FormPopup);
