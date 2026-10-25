// dizayn-v2: superadmin-notifications-telegram-groups
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../shared/ui/primitives";
import { inactiveReasonTone, type NotificationInactiveReason } from "../lib/inactiveReason";

/**
 * Guruh ulanishi holati: «Faol» — `success`; «Nofaol» — ton sababga qarab (G085w5Qr, NG-C; maket
 * `*-notifications-telegram-groups`): bot guruhga yetolmaydi (`kicked`, `left`, `blocked_on_send`, `chat_not_found`) —
 * `danger`, qo'lda nofaol qilingan (`manual`) yoki sabab noma'lum (`null`) — `neutral` (D1). Rang har doim so'z va
 * yonidagi sabab matni (`NotificationInactiveNote`) bilan (DESIGN_SYSTEM §8).
 */
const NotificationStatusBadge = ({
  active,
  reason = null,
}: {
  active: boolean;
  reason?: NotificationInactiveReason | null;
}) => {
  const { t } = useTranslation("notificationGroups");

  return active ? (
    <StatusBadge tone="success" label={t("status.active")} />
  ) : (
    <StatusBadge tone={inactiveReasonTone(reason)} label={t("status.inactive")} />
  );
};

export default memo(NotificationStatusBadge);
