import { memo } from "react";
import { BrushCleaning } from "lucide-react";
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
  void responsiveIconOnly;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("clear")}
      className={`inline-flex h-12 w-12 min-w-12 items-center justify-center rounded-xl border border-rose-500/35 bg-linear-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/20 transition-all hover:-translate-y-0.5 hover:shadow-rose-500/30 active:translate-y-0 dark:border-rose-300/20 dark:from-rose-500 dark:to-red-500 dark:text-white ${className}`}
    >
      <BrushCleaning size={16} />
    </button>
  );
};

export default memo(FilterClearButton);
