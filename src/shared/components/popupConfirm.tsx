import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
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
  variant?: "danger" | "warning" | "success";
  theme?: "default" | "branch";
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
  theme = "default",
}: PopupConfirmProps) => {
  const { t } = useTranslation("common");

  const iconBg = variant === "danger"
    ? "bg-rose-100 dark:bg-rose-500/12"
    : variant === "success"
      ? "bg-emerald-100 dark:bg-emerald-500/12"
      : "bg-amber-100 dark:bg-amber-500/12";

  const iconColor = variant === "danger"
    ? "text-rose-500 dark:text-rose-300"
    : variant === "success"
      ? "text-emerald-500 dark:text-emerald-300"
      : "text-amber-500 dark:text-amber-300";

  const confirmButtonClassName = variant === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:border-rose-400/60 dark:hover:bg-rose-500/18"
    : variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/18"
      : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200 dark:hover:border-amber-400/60 dark:hover:bg-amber-500/18";

  const resolvedTitle = title ?? t("confirm");
  const resolvedConfirmLabel = confirmLabel ?? (variant === "danger" ? t("delete") : t("confirm"));
  const resolvedCancelLabel = cancelLabel ?? t("cancel");
  const HeaderIcon = variant === "success" ? CheckCircle2 : AlertTriangle;
  const ConfirmIcon = variant === "danger" ? Trash2 : CheckCircle2;

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <div data-theme={theme} className={`${popupStyles.panel} w-[92vw] max-w-md rounded-[1.75rem] px-8 py-7 text-center shadow-2xl`}>
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}>
          <HeaderIcon size={28} className={iconColor} />
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
                <ConfirmIcon size={16} />
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
