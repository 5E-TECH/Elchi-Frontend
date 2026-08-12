import { Tag } from "antd";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationPriority } from "../model/types";

const PRIORITY_COLOR: Record<NotificationPriority, string> = {
  low: "default",
  normal: "blue",
  high: "orange",
  critical: "red",
};

// `normal` is the common case and adds no signal — only surface the notable ones.
const NotificationPriorityTag = ({ priority }: { priority: NotificationPriority }) => {
  const { t } = useTranslation("notifications");
  if (priority === "normal" || priority === "low") {
    return null;
  }
  return (
    <Tag color={PRIORITY_COLOR[priority]} style={{ marginInlineEnd: 0 }}>
      {t(`priority.${priority}`)}
    </Tag>
  );
};

export default memo(NotificationPriorityTag);
