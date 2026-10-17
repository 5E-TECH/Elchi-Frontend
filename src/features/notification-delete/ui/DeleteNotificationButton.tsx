// dizayn-v2: superadmin-notifications-delete-dialog
import { Store, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationGroupTypeBadge, type Notification } from "../../../entities/notification";
import { notify } from "../../../shared/lib/notify";
import { IconButton, useConfirm } from "../../../shared/ui/primitives";
import { useDeleteNotification } from "../api/useDeleteNotification";

export type DeleteNotificationButtonProps = {
  notification: Notification;
  /** Market nomi (jadvaldagi ko'rinish bilan bir xil). */
  marketName: string;
  /** `sm` — jadval qatori; `lg` — telefon kartasi (≥ 44 px). */
  size?: "sm" | "lg";
};

/**
 * Guruh ulanishini o'chirish — tasdiq oynasi orqali (maket `superadmin-notifications-delete-dialog`):
 * «Haqiqatan ham o'chirmoqchimisiz?», market · xabar turi · guruh ID kartasi, «O'chirish» (danger).
 * So'rov xatosi oynaning o'zida ko'rinadi (`useConfirm` → `onConfirm`).
 */
const DeleteNotificationButton = ({ notification, marketName, size = "sm" }: DeleteNotificationButtonProps) => {
  const { t } = useTranslation("notifications");
  const confirm = useConfirm();
  const deleteNotification = useDeleteNotification();
  const typeGroup = t(`telegramGroups.typeGroup.${notification.group_type}`);

  const handleClick = async () => {
    const ok = await confirm({
      tone: "danger",
      icon: Trash2,
      title: t("telegramGroups.delete.title"),
      description: t(
        notification.group_type === "cancel"
          ? "telegramGroups.delete.descriptionCancel"
          : "telegramGroups.delete.descriptionCreate",
        { market: marketName },
      ),
      details: (
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
          >
            <Store size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-text">
                {marketName}{" "}
                <span className="whitespace-nowrap text-[13px] font-normal text-text-muted">#{notification.market_id}</span>
              </span>
              <NotificationGroupTypeBadge type={notification.group_type} />
            </span>
            <span className="text-[13px] text-text-muted">
              {t("telegramGroups.delete.groupId", { id: notification.group_id })}
            </span>
          </span>
        </div>
      ),
      confirmLabel: t("telegramGroups.delete.confirm"),
      confirmIcon: Trash2,
      loadingLabel: t("telegramGroups.delete.loading"),
      cancelLabel: t("telegramGroups.cancel"),
      onConfirm: () => deleteNotification.mutateAsync(notification.id),
    });

    if (ok) notify.success(t("telegramGroups.delete.success"));
  };

  return (
    <IconButton
      variant="danger"
      size={size}
      icon={Trash2}
      label={t("telegramGroups.actions.deleteLabel", { market: marketName, type: typeGroup })}
      aria-haspopup="dialog"
      onClick={() => void handleClick()}
    />
  );
};

export default DeleteNotificationButton;
