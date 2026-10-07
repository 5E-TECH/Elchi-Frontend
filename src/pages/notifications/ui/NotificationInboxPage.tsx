import { Bell, MessageSquareText, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canSendNotifications } from "../../../app/lib/access";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import { NotificationInboxList } from "../../../widgets/notification-inbox";
import { PushPermissionButton } from "../../../features/push-notifications";

/**
 * Per-user notification inbox (received notifications: read/unread, mark-read,
 * delete). Reached from the header bell. Distinct from the admin
 * `NotificationsPage` (Telegram notification-group configuration).
 */
const NotificationInboxPage = () => {
  const { t } = useTranslation("notifications");
  const canSend = useSelector(canSendNotifications);

  return (
    <PageContainer className="relative overflow-hidden">
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <HeaderName
          name={t("inboxTitle")}
          description={t("inboxDescription")}
          icon={<Bell size={22} />}
        />
        <div className="flex flex-wrap items-start gap-2">
          {/* Telefon/brauzerga push — har bir foydalanuvchi o'zi yoqadi (davC9QOX). */}
          <PushPermissionButton />
          {/* Xabar yuborish ekraniga yo'l — faqat yubora oladiganlarga (superadmin/admin). */}
          {canSend ? (
            <Link
              to="/notifications/send"
              className="inline-flex h-10 items-center gap-2 self-start rounded-xl bg-main px-4 text-sm font-bold text-white transition-colors hover:bg-main/90"
            >
              <Send size={16} />
              {t("dispatch.openSend")}
            </Link>
          ) : null}
          {canSend ? (
            <Link
              to="/notifications/sms"
              className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-main px-4 text-sm font-bold text-main transition-colors hover:bg-main hover:text-white"
            >
              <MessageSquareText size={16} />
              SMS
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 mt-6">
        <NotificationInboxList />
      </div>
    </PageContainer>
  );
};

export default NotificationInboxPage;
