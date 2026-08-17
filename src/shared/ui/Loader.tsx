import { useTranslation } from "react-i18next";

type LoaderProps = {
  className?: string;
};

export const Loader = ({ className = "" }: LoaderProps) => {
  const { t } = useTranslation("common");

  return (
    <div
      className={`h-8 w-8 rounded-full border-2 border-main/20 border-t-main animate-spin ${className}`.trim()}
      aria-label={t("loading")}
      role="status"
    />
  );
};

export default Loader;
