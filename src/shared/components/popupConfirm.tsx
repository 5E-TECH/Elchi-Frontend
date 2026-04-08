import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2 } from "lucide-react";
import Popup from "../ui/Popup";
import popupStyles from "../ui/FormPopup/FormPopup.module.css";

interface PopupConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning";
}

const PopupConfirm = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  variant = "danger",
}: PopupConfirmProps) => {
  const { t } = useTranslation("common");

  const iconBg = variant === "danger"
    ? "bg-rose-100 dark:bg-rose-500/12"
    : "bg-amber-100 dark:bg-amber-500/12";

  const iconColor = variant === "danger"
    ? "text-rose-500 dark:text-rose-300"
    : "text-amber-500 dark:text-amber-300";

  const confirmButtonClassName = variant === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:border-rose-400/60 dark:hover:bg-rose-500/18"
    : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200 dark:hover:border-amber-400/60 dark:hover:bg-amber-500/18";

  const resolvedTitle = title ?? t("confirm");
  const resolvedConfirmLabel = confirmLabel ?? t("delete");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div className={`${popupStyles.panel} w-[92vw] max-w-md rounded-[1.75rem] px-8 py-7 text-center shadow-2xl`}>
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}>
          <AlertTriangle size={28} className={iconColor} />
        </div>

        <h3 className="mb-2 text-xl font-bold text-maindark dark:text-white">
          {resolvedTitle}
        </h3>

        {message && (
          <div className="mb-6 text-sm text-text-muted dark:text-text-muted-dark">
            {message}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-border-soft px-6 py-2.5 text-sm font-medium text-maindark transition-colors hover:bg-main-soft disabled:opacity-50 dark:text-white/85 dark:hover:bg-white/10"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${confirmButtonClassName}`}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                {t("submitting")}
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {resolvedConfirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default memo(PopupConfirm);
