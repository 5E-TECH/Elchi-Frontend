import { memo } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FilterClearButtonProps {
  onClick: () => void;
  className?: string;
}

const FilterClearButton = ({ onClick, className = "" }: FilterClearButtonProps) => {
  const { t } = useTranslation("common");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/14 hover:text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/14 dark:hover:text-red-200 sm:w-auto sm:justify-start ${className}`}
    >
      <RefreshCw size={14} />
      {t("clear")}
    </button>
  );
};

export default memo(FilterClearButton);
