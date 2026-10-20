// dizayn-v2: superadmin-notifications-delete-dialog
import { useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationGroupSummary, type Notification } from "../../../entities/notification";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { useDeleteNotification } from "../api/useDeleteNotification";

/**
 * Telegram guruhini o'chirish — buzuvchi amal, tasdiq oynasi orqali (maket `superadmin-notifications-delete-dialog`):
 * «Haqiqatan ham o'chirmoqchimisiz?», «<market>'ning <turi> buyurtmalari haqidagi xabarlar bu guruhga endi
 * yuborilmaydi…», ob'ekt kartasi (market #id, turi, «Guruh ID: …»), «O'chirish» (qizil). So'rov ketayotganda oyna
 * qulflanadi, xato oyna ichida (faqat i18n matn); muvaffaqiyat — «Bildirishnoma o'chirildi».
 *
 * Market nomi chaqiruvchidan keladi: `GET /notifications` qatorida market obyekti yo'q, nom marketlar ro'yxatidan
 * (`useNotificationMarkets`) olinadi — jadvaldagi ko'rinish bilan bir xil bo'lsin.
 *
 *   const confirmDelete = useDeleteNotificationConfirm();
 *   onSelect: () => void confirmDelete(row, marketName(row))   // qator menyusidagi «O'chirish»
 */
export const useDeleteNotificationConfirm = () => {
  const { t } = useTranslation("notificationGroups");
  const confirm = useConfirm();
  const deleteNotification = useDeleteNotification();
  const { mutateAsync } = deleteNotification;

  return useCallback(
    async (row: Notification, marketName: string) => {
      const ok = await confirm({
        tone: "danger",
        title: t("deleteDialog.title"),
        description: t(`deleteDialog.description.${row.group_type}`, { market: marketName }),
        icon: Trash2,
        confirmIcon: Trash2,
        confirmLabel: t("deleteDialog.confirm"),
        loadingLabel: t("deleteDialog.loading"),
        cancelLabel: t("form.cancel"),
        details: <NotificationGroupSummary row={row} marketName={marketName} />,
        // Xom backend matni ko'rsatilmaydi — faqat i18n.
        errorMessage: () => t("deleteDialog.failed"),
        onConfirm: () => mutateAsync(row.id),
      });
      if (ok) notify.success(t("deleteDialog.deleted"));
      return ok;
    },
    [confirm, mutateAsync, t],
  );
};

export default useDeleteNotificationConfirm;
