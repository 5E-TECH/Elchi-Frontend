import { memo, type ReactNode, type FormEventHandler } from "react";
import { useTranslation } from "react-i18next";
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
  theme?: "default" | "branch" | "market";
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
  submitLabel,
  cancelLabel,
  isLoading = false,
  children,
  widthClassName = "max-w-2xl",
  theme = "default",
}: FormPopupProps) => {
  const { t } = useTranslation("common");
  const resolvedSubmitLabel = submitLabel ?? t("save");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <form
        onSubmit={onSubmit}
        data-theme={theme}
        className={`${styles.panel} flex max-h-[90vh] w-[94vw] ${widthClassName} flex-col overflow-hidden rounded-3xl sm:w-[92vw] sm:rounded-[1.75rem]`}
      >
        <div className={`${styles.header} flex items-start justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-4 sm:gap-4 sm:px-6 sm:py-5`}>
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-white shadow-[0_16px_30px_rgba(87,106,219,0.28)] sm:h-12 sm:w-12">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-[var(--color-maindark)] dark:text-white sm:text-xl">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)] sm:text-sm">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 text-[var(--color-maindark)] transition-colors hover:bg-[var(--color-main-soft)] dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`${styles.body} ${styles.form} custom-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5`}>
          {children}
        </div>

        <div className={`${styles.footer} flex flex-col-reverse gap-3 border-t border-[color:var(--color-border-soft)] px-4 py-4 sm:flex-row sm:px-6 sm:py-5`}>
          <Button
            type="button"
            label={resolvedCancelLabel}
            onClick={onClose}
            className="flex-1 !bg-transparent !text-[var(--color-maindark)] !shadow-none border border-[color:var(--color-border-soft)] hover:!bg-[var(--color-main-soft)] dark:!text-white/85 dark:hover:!bg-white/10"
          />
          <Button
            type="submit"
            label={isLoading ? t("submitting") : resolvedSubmitLabel}
            disabled={isLoading}
            className="flex-1 !bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] hover:opacity-95"
          />
        </div>
      </form>
    </Popup>
  );
};

export default memo(FormPopup);
