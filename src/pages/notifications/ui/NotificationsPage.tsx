import { useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Bell } from "lucide-react";
import type { Notification } from "../../../entities/notification";
import { NotificationEditModal } from "../../../features/notification-edit";
import { NotificationFormModal } from "../../../features/notification-create";
import Button from "../../../shared/components/button";
import HeaderName from "../../../shared/components/headerName";
import { NotificationTable } from "../../../widgets/notification-table";

const NotificationsPage = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  return (
    <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HeaderName
          name="Bildirishnomalar"
          description="Tizim bildirishnomalarini boshqarish"
          icon={<Bell size={22} />}
        />
        <Button
          label="Qo'shish"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto"
        />
      </div>

      <NotificationTable
        onEdit={(record) => setEditingNotification(record)}
      />

      <NotificationFormModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <NotificationEditModal
        open={Boolean(editingNotification)}
        initialData={editingNotification}
        onClose={() => setEditingNotification(null)}
      />
    </div>
  );
};

export default NotificationsPage;
