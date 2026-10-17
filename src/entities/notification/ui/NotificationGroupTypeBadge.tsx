// dizayn-v2: superadmin-notifications-telegram-groups
import { useTranslation } from "react-i18next";
import { Badge } from "../../../shared/ui/primitives";
import type { NotificationGroupType } from "../model/types";

/** Xabar turi — neytral belgi (maket: «Yangi buyurtma» / «Bekor qilingan buyurtma», `.el-tone-neutral`). */
const NotificationGroupTypeBadge = ({ type }: { type: NotificationGroupType }) => {
  const { t } = useTranslation("notifications");
  return <Badge className="whitespace-nowrap">{t(`telegramGroups.type.${type}`)}</Badge>;
};

export default NotificationGroupTypeBadge;
