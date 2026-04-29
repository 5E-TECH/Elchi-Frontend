import { memo } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FilterClearButtonProps {
  onClick: () => void;
  className?: string;
  responsiveIconOnly?: boolean;
}

const FilterClearButton = ({
  onClick,
  className = "",
  responsiveIconOnly = false,
}: FilterClearButtonProps) => {
  const { t } = useTranslation("common");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("clear")}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-linear-to-r from-rose-500 to-red-500 px-3.5 py-2 text-sm font-extrabold text-white shadow-lg shadow-rose-500/20 transition-all hover:-translate-y-0.5 hover:shadow-rose-500/30 active:translate-y-0 dark:border-rose-300/20 dark:from-rose-500 dark:to-red-500 dark:text-white sm:w-auto sm:justify-start ${responsiveIconOnly ? "md:w-12 md:justify-center md:px-0 xl:w-auto xl:px-3.5" : ""} ${className}`}
    >
      <RefreshCw size={14} />
      <span className={responsiveIconOnly ? "md:hidden xl:inline" : ""}>
        {t("clear")}
      </span>
    </button>
  );
};

export default memo(FilterClearButton);
