import { Button } from "antd";
import { useMemo, useState } from "react";
import { EditOutlined } from "@ant-design/icons";
import {
  NotificationStatusBadge,
  useNotifications,
  type Notification,
  type NotificationParams,
} from "../../../entities/notification";
import { DeleteNotificationButton } from "../../../features/notification-delete";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import { formatDate } from "../../../shared/lib/formatDate";

interface NotificationTableProps {
  onEdit: (record: Notification) => void;
}

const statusOptions = [
  { value: "active", label: "Faol" },
  { value: "inactive", label: "Nofaol" },
];

const NotificationTable = ({ onEdit }: NotificationTableProps) => {
  const [params, setParams] = useState<NotificationParams>({
    page: 1,
    limit: 10,
    search: "",
    status: "",
  });
  const { data, isLoading } = useNotifications(params);

  const columns: ColumnConfig<Notification>[] = useMemo(
    () => [
      {
        key: "user",
        label: "Foydalanuvchi",
        sortable: true,
        sortValue: (row) => row.user.fullName,
        render: (_, record) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-white">{record.user.fullName}</span>
            <span className="text-xs text-[var(--color-text-muted)]">@{record.user.username}</span>
          </div>
        ),
      },
      {
        key: "chat_id",
        label: "Chat ID",
        sortable: true,
        className: "font-mono text-xs sm:text-sm text-gray-600 dark:text-gray-300",
      },
      {
        key: "status",
        label: "Holat",
        sortable: true,
        render: (status: Notification["status"]) => <NotificationStatusBadge status={status} />,
      },
      {
        key: "created_at",
        label: "Sana",
        sortable: true,
        sortValue: (row) => new Date(row.created_at).getTime(),
        render: (value: string) => formatDate(value),
      },
      {
        key: "id",
        label: "Amallar",
        render: (_, record) => (
          <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
              Tahrirlash
            </Button>
            <DeleteNotificationButton id={record.id} />
          </div>
        ),
      },
    ],
    [onEdit],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-sm dark:border-primarydark/60 dark:bg-maindark">
      <div className="border-b border-gray-200 p-4 dark:border-primarydark/60 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <FilterSearch
              value={params.search ?? ""}
              placeholder="Foydalanuvchi yoki chat ID bo'yicha qidirish"
              onChange={(search) => setParams((prev) => ({ ...prev, search, page: 1 }))}
              debounceDelay={400}
            />
          </div>
          <div className="w-full xl:w-[180px]">
            <FilterSelect
              name="notification_status"
              label="Holat"
              value={params.status ?? ""}
              onChange={(status) => setParams((prev) => ({ ...prev, status: status as NotificationParams["status"], page: 1 }))}
              options={statusOptions}
              placeholder="Barchasi"
            />
          </div>
        </div>
      </div>

      <Table
        keyExtractor={(item) => item.id}
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="Bildirishnomalar topilmadi"
      />

      <div
        className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-primarydark/60"
        style={{
          background: "linear-gradient(90deg, var(--color-main) 0%, var(--color-primarydark) 100%)",
        }}
      >
        <span className="text-sm text-white">
          {data?.total
            ? `${(data.page - 1) * data.limit + 1}-${Math.min(data.page * data.limit, data.total)} dan ${data.total} tasi ko'rsatilmoqda`
            : "0 ta bildirishnoma"}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setParams((prev) => ({ ...prev, page: Math.max((data?.page ?? prev.page ?? 1) - 1, 1) }))
            }
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(data?.page ?? params.page ?? 1) <= 1}
          >
            Oldingi
          </button>
          <span className="px-2 text-sm font-medium text-white">
            {data?.page ?? params.page ?? 1} / {Math.max(Math.ceil((data?.total ?? 0) / (data?.limit ?? params.limit ?? 10)), 1)}
          </span>
          <button
            type="button"
            onClick={() =>
              setParams((prev) => ({ ...prev, page: (data?.page ?? prev.page ?? 1) + 1 }))
            }
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(data?.page ?? params.page ?? 1) >= Math.max(Math.ceil((data?.total ?? 0) / (data?.limit ?? params.limit ?? 10)), 1)}
          >
            Keyingi
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationTable;
