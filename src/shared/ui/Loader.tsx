import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";
import { Spinner } from "./primitives/Spinner";

type LoaderProps = {
  className?: string;
};

/**
 * v1 → v2 O'RAMI: blok yuklanishi halqasi — `Spinner size="lg"` (`.el-spinner-lg`, 32 px, `action` rangida),
 * ekran o'quvchiga «Yuklanmoqda…» (`role="status"`). Sahifa va ro'yxat uchun — skelet (`QueryBoundary`).
 */
export const Loader = ({ className = "" }: LoaderProps) => {
  const { t } = useTranslation("ui");

  return <Spinner size="lg" label={t("states.loading")} className={cx("text-action-fg", className)} />;
};

export default Loader;
