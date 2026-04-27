import { Badge } from "antd";
import { memo } from "react";
import { useTranslation } from "react-i18next";

const BranchStatusBadge = ({ status }: { status: "active" | "inactive" }) => {
  const { t } = useTranslation("branches");
  const isActive = status === "active";

  return (
    <Badge
      color={isActive ? "#22c55e" : "#ef4444"}
      text={<span className="text-[var(--color-maindark)] dark:text-white">{isActive ? t("status.active") : t("status.inactive")}</span>}
    />
  );
};

export default memo(BranchStatusBadge);
