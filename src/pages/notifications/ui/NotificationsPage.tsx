// dizayn-v2: superadmin-notifications-telegram-groups
import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Notification } from "../../../entities/notification";
import { NotificationFormModal } from "../../../features/notification-create";
import { NotificationEditModal } from "../../../features/notification-edit";
import { Button, PageHeader } from "../../../shared/ui/primitives";
import { NotificationTable } from "../../../widgets/notification-table";

/**
 * Bildirishnomalar — marketlarning Telegram guruhlari (faqat superadmin). Maketlar:
 * `superadmin-notifications-telegram-groups`, `-create-dialog`, `-delete-dialog`.
 */
const NotificationsPage = () => {
  const { t } = useTranslation("notifications");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Notification | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("telegramGroups.title")}
        description={t("telegramGroups.subtitle")}
        actions={
          <Button leftIcon={Plus} aria-haspopup="dialog" onClick={() => setIsCreateOpen(true)}>
            {t("telegramGroups.add")}
          </Button>
        }
      />

      <NotificationTable onEdit={setEditTarget} />

      <NotificationFormModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <NotificationEditModal open={Boolean(editTarget)} initialData={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
};

export default NotificationsPage;
