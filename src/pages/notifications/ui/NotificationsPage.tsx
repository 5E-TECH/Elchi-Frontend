import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";

const NotificationsPage = () => {
  const { t } = useTranslation("common");

  return (
    <div className="relative min-h-full overflow-hidden rounded-[28px] p-4 md:p-6">
      <div className="relative z-10">
        <HeaderName
          name={t("notifications")}
          description={t("notificationsDescription")}
          icon={<Bell size={22} />}
        />
      </div>
    </div>
  );
};

export default NotificationsPage;
