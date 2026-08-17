import { Badge } from "antd";
import { memo } from "react";
import { useTranslation } from "react-i18next";

const NotificationStatusBadge = ({ status }: { status: "active" | "inactive" }) => {
  const { t } = useTranslation("common");

  return <Badge status={status === "active" ? "success" : "default"} text={status === "active" ? t("active") : t("inactive")} />;
};

export default memo(NotificationStatusBadge);
