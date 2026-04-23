import { Button } from "antd";
import { useMemo, useState } from "react";
import { EditOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import {
  NotificationStatusBadge,
  useNotifications,
  type Notification,
  type NotificationParams,
} from "../../../entities/notification";
import { DeleteNotificationButton } from "../../../features/notification-delete";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { formatDate } from "../../../shared/lib/formatDate";
import Pagination from "../../../shared/components/pagination";

interface NotificationTableProps {
  onEdit: (record: Notification) => void;
}

const NotificationTable = ({ onEdit }: NotificationTableProps) => {
  const { t } = useTranslation("common");
  const [params, setParams] = useState<NotificationParams>({
    page: 1,
    limit: 10,
  });
  const { data, isLoading } = useNotifications(params);
  const currentPage = data?.page ?? params.page ?? 1;
  const currentLimit = data?.limit ?? params.limit ?? 10;
  const totalItems = data?.total ?? 0;

  const columns: ColumnConfig<Notification>[] = useMemo(
    () => [
      {
        key: "user",
        label: t("notificationUser"),
        sortable: true,
        sortValue: (row) => row.user?.fullName ?? "",
        render: (_, record) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-white">{record.user?.fullName ?? "—"}</span>
            <span className="text-xs text-[var(--color-text-muted)]">@{record.user?.username ?? "—"}</span>
          </div>
        ),
      },
      {
        key: "chat_id",
        label: t("notificationChatId"),
        sortable: true,
        className: "font-mono text-xs sm:text-sm text-gray-600 dark:text-gray-300",
      },
      {
        key: "status",
        label: t("status"),
        sortable: true,
        render: (status: Notification["status"]) => <NotificationStatusBadge status={status} />,
      },
      {
        key: "created_at",
        label: t("date"),
        sortable: true,
        sortValue: (row) => new Date(row.created_at).getTime(),
        render: (value: string) => formatDate(value),
      },
      {
        key: "id",
        label: t("actions"),
        render: (_, record) => (
          <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
              {t("edit")}
            </Button>
            <DeleteNotificationButton id={record.id} />
          </div>
        ),
      },
    ],
    [onEdit, t],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-sm dark:border-primarydark/60 dark:bg-maindark">
      <Table
        keyExtractor={(item) => item.id}
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage={t("notificationsNotFound")}
      />

      <div
        className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-primarydark/60"
        style={{
          background: "linear-gradient(90deg, var(--color-main) 0%, var(--color-primarydark) 100%)",
        }}
      >
        <span className="text-sm text-white">
          {totalItems
            ? t("paginationSummary", {
                from: (currentPage - 1) * currentLimit + 1,
                to: Math.min(currentPage * currentLimit, totalItems),
                total: totalItems,
              })
            : t("notificationsEmptyCount")}
        </span>

        <Pagination
          totalItems={totalItems}
          itemsPerPage={currentLimit}
          currentPage={currentPage}
          onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
          onItemsPerPageChange={(limit) => setParams((prev) => ({ ...prev, page: 1, limit }))}
          className="w-full pt-0 sm:w-auto"
          summary={null}
        />
      </div>
    </div>
  );
};

export default NotificationTable;
