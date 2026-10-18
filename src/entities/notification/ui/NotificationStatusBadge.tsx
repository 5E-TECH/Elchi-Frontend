// dizayn-v2: superadmin-notifications-telegram-groups
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../shared/ui/primitives";

/**
 * Guruh ulanishi holati (Trello 9HIaV80X): «Faol» — `success`; «Nofaol» — `danger`.
 *
 * Ton (DESIGN_SYSTEM §8): nofaollik bu yerda ataylab yopilgan holat (neytral) emas, yetkazish XATOSI —
 * bot guruhdan chiqarilgan yoki guruhga yetib bo'lmaydi, xabarlar bormayapti va admin qayta ulashi kerak
 * (backend shu payt «Telegram guruhi nofaol» muhim bildirishnomasini ham yuboradi). Xato → `danger`.
 */
const NotificationStatusBadge = ({ active }: { active: boolean }) => {
  const { t } = useTranslation("notificationGroups");

  return active ? (
    <StatusBadge tone="success" label={t("status.active")} />
  ) : (
    <StatusBadge tone="danger" label={t("status.inactive")} />
  );
};

export default memo(NotificationStatusBadge);
