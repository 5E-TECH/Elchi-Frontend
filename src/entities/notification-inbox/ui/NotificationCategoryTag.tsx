import { Tag } from "antd";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationCategory } from "../model/types";

const CATEGORY_COLOR: Record<NotificationCategory, string> = {
  order: "blue",
  finance: "green",
  branch: "geekblue",
  logistics: "cyan",
  account: "purple",
  system: "default",
  marketing: "magenta",
};

const NotificationCategoryTag = ({ category }: { category: NotificationCategory }) => {
  const { t } = useTranslation("notifications");
  return (
    <Tag color={CATEGORY_COLOR[category]} style={{ marginInlineEnd: 0 }}>
      {t(`category.${category}`)}
    </Tag>
  );
};

export default memo(NotificationCategoryTag);
