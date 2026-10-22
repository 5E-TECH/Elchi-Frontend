import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";

type BackButtonProps = {
  to?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
};

const BackButton = ({ to, label, className, onClick }: BackButtonProps) => {
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

  // xYWDHMTi: faqat v2 tokenlari (eski binafsha alias va tungi juftlar o'rniga): tungi mavzuda ham matn `text`,
  // hover `action-fg` (≥ 4.5:1). Telefonda (< 768) faqat ikonka, nomi `aria-label` da.
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cx(
        "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3",
        "text-sm font-semibold text-text transition-[color,border-color] duration-150 motion-reduce:transition-none",
        "hover:border-border-strong hover:text-action-fg",
        className,
      )}
      aria-label={resolvedLabel || t("back")}
    >
      <ArrowLeft size={18} aria-hidden="true" />
      {resolvedLabel ? <span className="max-md:hidden">{resolvedLabel}</span> : null}
    </button>
  );
};

export default memo(BackButton);
