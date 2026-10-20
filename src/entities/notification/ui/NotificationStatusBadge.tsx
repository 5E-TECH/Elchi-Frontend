// dizayn-v2: superadmin-notifications-telegram-groups
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../shared/ui/primitives";

/**
 * Guruh ulanishi holati: «Faol» — `success`; «Nofaol» — `neutral`.
 *
 * Ton (DESIGN_SYSTEM §8, NG-A): nofaollik sababi API'da yo'q (`inactive_reason` — backend G085w5Qr, NG-C). Ulanish
 * endi qo'lda ham nofaol qilinadi (`PATCH {is_active: false}`) — maketda bu holat neytral, «bot chiqarilgan» esa
 * qizil. Sabab noma'lum ekan, belgi neytral va izoh umumiy (D1: «bot chiqarilgan» deb yozilmaydi); sababga qarab
 * ton NG-C da (`inactive_reason` kelgach) qo'shiladi.
 */
const NotificationStatusBadge = ({ active }: { active: boolean }) => {
  const { t } = useTranslation("notificationGroups");

  return active ? (
    <StatusBadge tone="success" label={t("status.active")} />
  ) : (
    <StatusBadge tone="neutral" label={t("status.inactive")} />
  );
};

export default memo(NotificationStatusBadge);
