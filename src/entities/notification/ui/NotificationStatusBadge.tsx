import { Badge } from "antd";
import { memo } from "react";

const NotificationStatusBadge = ({ status }: { status: "active" | "inactive" }) => {
  return <Badge status={status === "active" ? "success" : "default"} text={status === "active" ? "Faol" : "Nofaol"} />;
};

export default memo(NotificationStatusBadge);
