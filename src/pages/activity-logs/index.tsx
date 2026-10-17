// dizayn-v2: superadmin-activity-logs-list, superadmin-activity-logs-row-expanded, admin-activity-logs-list, admin-activity-logs-row-expanded
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../shared/ui/primitives";
import { ActivityLogViewer } from "../../widgets/activity-log";

/**
 * `/activity-logs` — «Faoliyat jurnali» (superadmin, admin; maket `*-activity-logs-list`). Sahifa shell kontent
 * slotida: sarlavha + jurnal kartasi (filtrlar, jadval, sahifalash — `ActivityLogViewer`).
 */
const ActivityLogsPage = () => {
  const { t } = useTranslation("activityLogs");

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={t("description")} />
      <ActivityLogViewer />
    </div>
  );
};

export default ActivityLogsPage;
