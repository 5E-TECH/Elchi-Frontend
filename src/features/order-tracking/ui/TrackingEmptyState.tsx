import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

type TrackingEmptyStateProps = {
  type: "empty" | "error";
  message?: string;
  onRetry?: () => void;
};

export const TrackingEmptyState = ({ type, message, onRetry }: TrackingEmptyStateProps) => {
  const { t } = useTranslation("orders");
  const isError = type === "error";
  const Icon = isError ? AlertCircle : Inbox;

  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/70 px-5 py-8 text-center dark:border-white/10 dark:bg-primarydark/50">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${isError ? "bg-red-500/10 text-red-500" : "bg-main/10 text-main"}`}>
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {message || (isError ? t("tracking.error") : t("tracking.empty"))}
      </p>
      {isError && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-main/20 bg-main/10 px-4 py-2 text-sm font-semibold text-main transition-colors hover:bg-main/15"
        >
          <RefreshCw size={14} />
          {t("tracking.loadMore")}
        </button>
      ) : null}
    </div>
  );
};

export default TrackingEmptyState;
