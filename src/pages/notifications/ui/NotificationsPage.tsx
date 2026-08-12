import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import { NotificationInboxList } from "../../../widgets/notification-inbox";

const NotificationsPage = () => {
  const { t } = useTranslation("common");

  return (
    <PageContainer className="relative overflow-hidden">
      <div className="relative z-10 flex flex-col gap-6">
        <HeaderName
          name={t("notifications")}
          description={t("notificationsDescription")}
          icon={<Bell size={22} />}
        />
        <NotificationInboxList />
      </div>
    </PageContainer>
  );
};

export default NotificationsPage;
