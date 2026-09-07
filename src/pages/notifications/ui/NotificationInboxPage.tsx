import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import { NotificationInboxList } from "../../../widgets/notification-inbox";

/**
 * Per-user notification inbox (received notifications: read/unread, mark-read,
 * delete). Reached from the header bell. Distinct from the admin
 * `NotificationsPage` (Telegram notification-group configuration).
 */
const NotificationInboxPage = () => {
  const { t } = useTranslation("notifications");

  return (
    <PageContainer className="relative overflow-hidden">
      <div className="relative z-10">
        <HeaderName
          name={t("inboxTitle")}
          description={t("inboxDescription")}
          icon={<Bell size={22} />}
        />
      </div>

      <div className="relative z-10 mt-6">
        <NotificationInboxList />
      </div>
    </PageContainer>
  );
};

export default NotificationInboxPage;
