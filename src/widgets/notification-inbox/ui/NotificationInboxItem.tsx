// dizayn-v2: common-inbox, superadmin-notifications-inbox, courier-inbox-list
import { memo } from "react";
import {
  Bell,
  Building2,
  Check,
  Mail,
  MailOpen,
  Server,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { InboxNotification, NotificationCategory } from "../../../entities/notification-inbox";
import { useDeleteInboxNotification, useMarkInboxRead } from "../../../features/notification-inbox";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Badge, IconButton, useConfirm } from "../../../shared/ui/primitives";
import { NotificationItemMenu } from "./NotificationItemMenu";

type NotificationInboxItemProps = {
  notification: InboxNotification;
  /**
   * Oldindan ko'rish (xabar yuborish ekrani): hali yuborilmagan xabar —
   * o'qildi/o'chirish tugmalari yo'q, bosilganda hech qayerga o'tmaydi,
   * sana o'rnida "hozir". Shu sabab soxta `id` hech qayerga ketmaydi.
   */
  preview?: boolean;
};

/** Kategoriya ikonkasi — yuqori paneldagi qo'ng'iroqcha ro'yxati (`NotificationsMenu`) bilan bir xil. */
const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  order: ShoppingBag,
  finance: Wallet,
  branch: Building2,
  logistics: Truck,
  account: User,
  system: Server,
  marketing: Bell,
};

/** `.el-stat-icon` 36 px — neytral. Oldindan ko'rishda `sunken` ustida — `surface` fon (maket `notifications-send`). */
const STAT_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-text-muted";

/**
 * BILDIRISHNOMA QATORI — maket `common-inbox` (`.el-list-item`): o'qilmagan nuqta (`info`), kategoriya ikonkasi
 * (telefonda yo'q), sarlavha (o'qilmagan — qalin) + muhimlik badge'i («Muhim» danger = critical, «Yuqori»
 * warning = high), matn, «<Kategoriya> · <vaqt>»; o'ngda «O'qilgan deb belgilash» (faqat o'qilmaganda, desktop)
 * va «…» menyusi («O'qilgan/O'qilmagan deb belgilash», «O'chirish» — tasdiq bilan).
 *
 * Xulq (avvalgidek): qator bosilsa — o'qilgan (best-effort) va havolaga o'tish; o'chirish `useConfirm`
 * (xato oynaning o'zida); `preview` — amallarsiz va bosilmaydigan karta (`/notifications/send`).
 */
const NotificationInboxItem = ({ notification, preview = false }: NotificationInboxItemProps) => {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const markRead = useMarkInboxRead();
  const deleteNotification = useDeleteInboxNotification();
  const confirm = useConfirm();

  const isUnread = !notification.is_read;
  const Icon = CATEGORY_ICON[notification.category] ?? Bell;
  const important = notification.priority === "critical" || notification.priority === "high";

  const handleToggleRead = async () => {
    try {
      await markRead.mutateAsync({ id: notification.id, read: isUnread });
    } catch {
      notify.error(t("actionError"));
    }
  };

  const handleDelete = async () => {
    // Xato oynaning o'zida ko'rinadi (qayta urinish yoki bekor qilish mumkin).
    const ok = await confirm({
      tone: "danger",
      title: t("deleteConfirm"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      icon: Trash2,
      confirmIcon: Trash2,
      errorMessage: () => t("deleteError"),
      onConfirm: () => deleteNotification.mutateAsync(notification.id),
    });
    if (ok) notify.success(t("deleteSuccess"));
  };

  const handleOpen = () => {
    if (isUnread) {
      // Best-effort: opening a notification marks it read, but navigation
      // should not be blocked if that write fails.
      markRead.mutate({ id: notification.id, read: true });
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const content = (
    <>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {isUnread ? <span className="sr-only">{t("inbox.unreadPrefix")}</span> : null}
        <span className={cx("min-w-0 text-sm text-text", isUnread ? "font-bold" : "font-medium")}>
          {notification.title}
        </span>
        {important ? (
          <Badge tone={notification.priority === "critical" ? "danger" : "warning"}>
            {t(`priority.${notification.priority}`)}
          </Badge>
        ) : null}
      </span>
      {notification.body ? (
        <span className="line-clamp-3 text-[13px] text-text-muted">{notification.body}</span>
      ) : null}
      <span className="text-xs text-text-subtle">
        {t(`category.${notification.category}`)} ·{" "}
        {preview ? (
          t("dispatch.previewNow")
        ) : (
          <time dateTime={notification.created_at}>
            {formatDateTimeLocalized(notification.created_at)}
          </time>
        )}
      </span>
    </>
  );

  if (preview) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-sunken py-4 pl-3 pr-4">
        <span
          aria-hidden="true"
          className={cx("mt-3.5 size-2 shrink-0 rounded-full", isUnread && "bg-info")}
        />
        <span aria-hidden="true" className={cx(STAT_ICON, "bg-surface")}>
          <Icon size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">{content}</div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-4 pl-3 pr-5 max-md:gap-2.5 max-md:pl-4 max-md:pr-3">
      <span
        aria-hidden="true"
        className={cx("mt-3.5 size-2 shrink-0 rounded-full max-md:mt-[7px]", isUnread && "bg-info")}
      />
      <span aria-hidden="true" className={cx(STAT_ICON, "bg-sunken max-md:hidden")}>
        <Icon size={20} />
      </span>
      <button
        type="button"
        onClick={handleOpen}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left"
      >
        {content}
      </button>
      <div className="flex flex-none items-center gap-1">
        {isUnread ? (
          <IconButton
            size="sm"
            icon={Check}
            label={t("markRead")}
            loading={markRead.isPending}
            onClick={() => void handleToggleRead()}
            className="max-md:hidden"
          />
        ) : null}
        <NotificationItemMenu
          label={t("inbox.actions")}
          actions={[
            {
              id: "toggle-read",
              label: isUnread ? t("markRead") : t("markUnread"),
              icon: isUnread ? MailOpen : Mail,
              onSelect: () => void handleToggleRead(),
            },
            {
              id: "delete",
              label: t("delete"),
              icon: Trash2,
              danger: true,
              onSelect: () => void handleDelete(),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default memo(NotificationInboxItem);
