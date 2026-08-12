import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";
import { ActivityLogViewer } from "../../widgets/activity-log";

const ActivityLogsPage = () => {
  const { t } = useTranslation("activityLogs");

  return (
    <PageContainer className="relative overflow-hidden">
      <div className="relative z-10 flex flex-col gap-6">
        <HeaderName
          name={t("title")}
          description={t("description")}
          icon={<ScrollText size={22} />}
        />
        <ActivityLogViewer />
      </div>
    </PageContainer>
  );
};

export default ActivityLogsPage;
