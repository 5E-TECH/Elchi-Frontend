// dizayn-v2: superadmin-notifications-delete-dialog
import { useCallback } from "react";
import { Store, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationGroupTypeBadge, type Notification } from "../../../entities/notification";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { useDeleteNotification } from "../api/useDeleteNotification";

/**
 * Telegram guruhini o'chirish — buzuvchi amal, tasdiq oynasi orqali (maket `superadmin-notifications-delete-dialog`):
 * «Haqiqatan ham o'chirmoqchimisiz?», «<market>'ning <turi> buyurtmalari haqidagi xabarlar bu guruhga endi
 * yuborilmaydi…», ob'ekt kartasi (market #id, turi, «Guruh ID: …»), «O'chirish» (qizil). So'rov ketayotganda oyna
 * qulflanadi, xato oyna ichida; muvaffaqiyat — «Bildirishnoma o'chirildi».
 *
 * Market nomi chaqiruvchidan keladi: `GET /notifications` qatorida market obyekti yo'q, nom marketlar ro'yxatidan
 * (`useNotificationMarkets`) olinadi — jadvaldagi ko'rinish bilan bir xil bo'lsin.
 *
 *   const confirmDelete = useDeleteNotificationConfirm();
 *   <IconButton aria-haspopup="dialog" onClick={() => void confirmDelete(row, marketName(row))} … />
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
        details: (
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
            >
              <Store size={18} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-text">{marketName}</span>
                {row.market_id ? <span className="text-text-muted">#{row.market_id}</span> : null}
                <NotificationGroupTypeBadge type={row.group_type} />
              </span>
              <span className="text-[13px] text-text-muted tabular-nums">
                {t("deleteDialog.groupId", { id: row.group_id })}
              </span>
            </span>
          </div>
        ),
        errorMessage: (error) => getBackendErrorMessage(error) ?? t("deleteDialog.failed"),
        onConfirm: () => mutateAsync(row.id),
      });
      if (ok) notify.success(t("deleteDialog.deleted"));
      return ok;
    },
    [confirm, mutateAsync, t],
  );
};

export default useDeleteNotificationConfirm;
