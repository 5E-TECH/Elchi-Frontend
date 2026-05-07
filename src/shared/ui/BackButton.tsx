import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

type BackButtonProps = {
  to?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
};

const BackButton = ({ to, label, className = "", onClick }: BackButtonProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const resolvedLabel = label === undefined ? t("back") : label || "";

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (to) {
      navigate(to);
      return;
    }

    navigate(-1);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary px-3 text-sm font-bold text-maindark transition hover:border-main/40 hover:text-main dark:bg-primarydark dark:text-white ${className}`}
      aria-label={resolvedLabel || t("back")}
    >
      <ArrowLeft size={18} />
      {resolvedLabel ? <span className="hidden sm:inline">{resolvedLabel}</span> : null}
    </button>
  );
};

export default memo(BackButton);
