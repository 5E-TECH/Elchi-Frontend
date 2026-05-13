import { memo } from "react";
import { useTranslation } from "react-i18next";

const BranchStatusBadge = ({ status }: { status: "active" | "inactive" }) => {
  const { t } = useTranslation("branches");
  const isActive = status === "active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold leading-none ${
        isActive
          ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-200"
          : "border-rose-400/35 bg-rose-500/12 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/12 dark:text-rose-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
      {isActive ? t("status.active") : t("status.inactive")}
    </span>
  );
};

export default memo(BranchStatusBadge);
