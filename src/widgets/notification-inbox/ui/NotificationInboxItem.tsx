import { memo } from "react";
import { Button, Popconfirm, Tooltip, message } from "antd";
import { Check, Mail, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  NotificationCategoryTag,
  NotificationPriorityTag,
  type InboxNotification,
} from "../../../entities/notification-inbox";
import {
  useDeleteInboxNotification,
  useMarkInboxRead,
} from "../../../features/notification-inbox";
import { formatDate } from "../../../shared/lib/formatDate";

const NotificationInboxItem = ({ notification }: { notification: InboxNotification }) => {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const markRead = useMarkInboxRead();
  const deleteNotification = useDeleteInboxNotification();

  const isUnread = !notification.is_read;

  const handleToggleRead = async () => {
    try {
      await markRead.mutateAsync({ id: notification.id, read: isUnread });
    } catch {
      message.error(t("actionError"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNotification.mutateAsync(notification.id);
      message.success(t("deleteSuccess"));
    } catch {
      message.error(t("deleteError"));
    }
  };

  const handleOpen = async () => {
    if (isUnread) {
      // Best-effort: opening a notification marks it read, but navigation
      // should not be blocked if that write fails.
      markRead.mutate({ id: notification.id, read: true });
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div
      className={`flex gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        isUnread
          ? "border-main/30 bg-main/[0.06] dark:bg-main/[0.12]"
          : "border-[color:var(--color-border-soft)] bg-primary dark:border-white/10 dark:bg-white/[0.02]"
      }`}
    >
      <span
        aria-hidden
        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-main" : "bg-transparent"}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <NotificationCategoryTag category={notification.category} />
          <NotificationPriorityTag priority={notification.priority} />
          <span className="ml-auto text-xs font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            {formatDate(notification.created_at)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpen}
          className="mt-1.5 block w-full text-left"
        >
          <h4
            className={`m-0 truncate text-sm text-maindark dark:text-white ${
              isUnread ? "font-black" : "font-semibold"
            }`}
          >
            {notification.title}
          </h4>
          {notification.body ? (
            <p className="m-0 mt-1 line-clamp-2 text-sm font-medium leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {notification.body}
            </p>
          ) : null}
        </button>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1">
        <Tooltip title={isUnread ? t("markRead") : t("markUnread")}>
          <Button
            type="text"
            size="small"
            aria-label={isUnread ? t("markRead") : t("markUnread")}
            icon={isUnread ? <Check size={16} /> : <Mail size={16} />}
            loading={markRead.isPending}
            onClick={handleToggleRead}
          />
        </Tooltip>
        <Popconfirm
          title={t("deleteConfirm")}
          okText={t("delete")}
          cancelText={t("cancel")}
          okButtonProps={{ danger: true }}
          onConfirm={handleDelete}
        >
          <Tooltip title={t("delete")}>
            <Button
              danger
              type="text"
              size="small"
              aria-label={t("delete")}
              icon={<Trash2 size={16} />}
              loading={deleteNotification.isPending}
            />
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
};

export default memo(NotificationInboxItem);
