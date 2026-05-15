import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";

const NotificationsPage = () => {
  const { t } = useTranslation("common");

  return (
    <PageContainer className="relative overflow-hidden">
      <div className="relative z-10">
        <HeaderName
          name={t("notifications")}
          description={t("notificationsDescription")}
          icon={<Bell size={22} />}
        />
      </div>
    </PageContainer>
  );
};

export default NotificationsPage;
