import { memo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import EmptyState from "./EmptyState";

interface QueryErrorStateProps {
  description?: string;
  onRetry?: () => void;
  className?: string;
}

const QueryErrorState = ({
  description,
  onRetry,
  className = "",
}: QueryErrorStateProps) => {
  const { t } = useTranslation("common");

  return (
    <EmptyState
      icon={<AlertTriangle size={28} />}
      title={t("error")}
      description={description}
      className={className}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-main px-4 py-2.5 text-sm font-bold text-white transition hover:bg-main/90"
          >
            <RefreshCw size={16} />
            {t("retry")}
          </button>
        ) : undefined
      }
    />
  );
};

export default memo(QueryErrorState);
