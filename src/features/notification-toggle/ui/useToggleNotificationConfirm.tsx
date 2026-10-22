// dizayn-v2: superadmin-notifications-deactivate-dialog, superadmin-notifications-activate-dialog
import { useCallback } from "react";
import { BellOff, BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  NoticeAlert,
  NotificationGroupSummary,
  type Notification,
} from "../../../entities/notification";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { useToggleNotification } from "../api/useToggleNotification";

/**
 * Guruhni nofaol qilish / faollashtirish — har doim tasdiq oynasi orqali (AGENTS: «nofaol qilish tasdiq bilan»):
 *
 * - faol guruh → «Nofaol qilishni tasdiqlang» (maket `*-deactivate-dialog`): buzuvchi (`danger`), `BellOff`;
 *   «… xabarlar bu guruhga yuborilmaydi. Ulanish o'chirilmaydi — …qayta faollashtirish mumkin.»
 * - nofaol guruh → «Faollashtirishni tasdiqlang» (maket `*-activate-dialog`): asosiy tugma, `BellRing`, ogohlantirish
 *   qutisi (`warning`). Maketdagi «Bot guruhdan chiqarilgan» sarlavhasi nofaollik sababiga bog'liq (`inactive_reason`
 *   — backend kerak, NG-C) — hozir sababdan qat'i nazar umumiy matn: «Bot guruhda ekanini tekshiring».
 *
 * Ikkalasi `PATCH /notifications/:id { is_active }`. So'rov ketayotganda oyna qulflanadi; xato — oyna ichida, faqat
 * i18n matn (backend `message` ko'rsatilmaydi); muvaffaqiyat — toast.
 *
 *   const confirmToggle = useToggleNotificationConfirm();
 *   onSelect: () => void confirmToggle(row, marketName(row))
 */
export const useToggleNotificationConfirm = () => {
  const { t } = useTranslation("notificationGroups");
  const confirm = useConfirm();
  const { mutateAsync } = useToggleNotification();

  return useCallback(
    async (row: Notification, marketName: string) => {
      const activate = !row.is_active;
      const scope = activate ? "toggle.activate" : "toggle.deactivate";
      const icon = activate ? BellRing : BellOff;

      const ok = await confirm({
        tone: activate ? "primary" : "danger",
        title: t(`${scope}.title`),
        description: t(`${scope}.description.${row.group_type}`, { market: marketName }),
        icon,
        iconTone: activate ? "info" : "danger",
        confirmIcon: icon,
        confirmLabel: t(`${scope}.confirm`),
        loadingLabel: t(`${scope}.loading`),
        cancelLabel: t("form.cancel"),
        details: <NotificationGroupSummary row={row} marketName={marketName} />,
        children: activate ? (
          <NoticeAlert tone="warning" role="note" title={t("toggle.activate.warningTitle")}>
            {t("toggle.activate.warning")}
          </NoticeAlert>
        ) : undefined,
        errorMessage: () => t(`${scope}.failed`),
        onConfirm: () => mutateAsync({ id: row.id, is_active: activate }),
      });
      if (ok) notify.success(t(`${scope}.done`));
      return ok;
    },
    [confirm, mutateAsync, t],
  );
};

export default useToggleNotificationConfirm;
