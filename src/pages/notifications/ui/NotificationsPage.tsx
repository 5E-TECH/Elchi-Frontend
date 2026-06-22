import { Button } from "antd";
import { Bell, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Notification } from "../../../entities/notification";
import { NotificationFormModal } from "../../../features/notification-create";
import { NotificationEditModal } from "../../../features/notification-edit";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import { NotificationTable } from "../../../widgets/notification-table";

const NotificationsPage = () => {
  const { t } = useTranslation("common");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Notification | null>(null);

  return (
    <PageContainer className="relative overflow-hidden">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <HeaderName
          name={t("notifications")}
          description={t("notificationsDescription")}
          icon={<Bell size={22} />}
        />

        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsCreateOpen(true)}
          className="h-10 self-start rounded-xl font-semibold"
        >
          {t("addNotification")}
        </Button>
      </div>

      <div className="relative z-10 mt-6">
        <NotificationTable onEdit={setEditTarget} />
      </div>

      <NotificationFormModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <NotificationEditModal
        open={Boolean(editTarget)}
        initialData={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </PageContainer>
  );
};

export default NotificationsPage;
