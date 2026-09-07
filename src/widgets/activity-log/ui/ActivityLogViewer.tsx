import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Input, Select, Table, Tag, type TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ACTIVITY_SERVICES,
  ActivityActionTag,
  useActivityActions,
  useActivityLogs,
  type ActivityLog,
  type ActivityLogParams,
} from "../../../entities/activity-log";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import { formatDate } from "../../../shared/lib/formatDate";
import ActivityLogDetail from "./ActivityLogDetail";

const { RangePicker } = DatePicker;
const PAGE_SIZE = 20;
type DateRange = [Dayjs | null, Dayjs | null] | null;

const ActivityLogViewer = () => {
  const { t } = useTranslation("activityLogs");

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [service, setService] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Every filter change returns to the first page. Done in the event handlers
  // (not an effect) so we never trigger a cascading setState-in-effect render.
  const onFirstPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const params = useMemo<ActivityLogParams>(() => {
    const next: ActivityLogParams = { page, limit: PAGE_SIZE };
    if (debouncedSearch) next.search = debouncedSearch;
    if (service) next.service = service;
    if (action) next.action = action;
    if (entityType.trim()) next.entity_type = entityType.trim();
    if (userId.trim()) next.user_id = userId.trim();
    if (dateRange?.[0]) next.from = dateRange[0].startOf("day").toISOString();
    if (dateRange?.[1]) next.to = dateRange[1].endOf("day").toISOString();
    return next;
  }, [page, debouncedSearch, service, action, entityType, userId, dateRange]);

  const { data, isLoading, isFetching, isError, refetch } = useActivityLogs(params);
  const { data: actions = [] } = useActivityActions();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setService(undefined);
    setAction(undefined);
    setEntityType("");
    setUserId("");
    setDateRange(null);
    setPage(1);
  };

  const hasFilters = Boolean(
    debouncedSearch || service || action || entityType || userId || dateRange,
  );

  const columns: TableColumnsType<ActivityLog> = [
    {
      title: t("columns.time"),
      dataIndex: "created_at",
      width: 160,
      render: (value: string) => (
        <span className="whitespace-nowrap text-xs font-medium">{formatDate(value)}</span>
      ),
    },
    {
      title: t("columns.actor"),
      width: 180,
      render: (_, record) => {
        const name = record.actor?.name || record.user_name || record.user_id || "—";
        const role = record.actor?.role || record.user_role;
        return (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{name}</div>
            {role ? <div className="text-xs text-[color:var(--color-text-muted)]">{role}</div> : null}
          </div>
        );
      },
    },
    {
      title: t("columns.action"),
      dataIndex: "action",
      width: 150,
      render: (value: string) => <ActivityActionTag action={value} />,
    },
    {
      title: t("columns.entity"),
      render: (_, record) => {
        const entityName =
          (record.entity?.name as string | undefined) ||
          (record.entity?.title as string | undefined);
        return (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {record.entity_type || "—"}
              {record.entity_id ? (
                <span className="text-[color:var(--color-text-muted)]"> #{record.entity_id}</span>
              ) : null}
            </div>
            {entityName ? <div className="truncate text-xs">{entityName}</div> : null}
          </div>
        );
      },
    },
    {
      title: t("columns.service"),
      dataIndex: "service",
      width: 130,
      render: (value: string | null) => (value ? <Tag>{value}</Tag> : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 dark:border-white/10 dark:bg-white/[0.02] md:grid-cols-2 lg:grid-cols-3">
        <Input.Search
          allowClear
          placeholder={t("filters.search")}
          value={searchInput}
          onChange={(event) => onFirstPage(setSearchInput)(event.target.value)}
        />
        <Select
          allowClear
          showSearch
          placeholder={t("filters.service")}
          value={service}
          onChange={onFirstPage(setService)}
          options={ACTIVITY_SERVICES.map((name) => ({ label: name, value: name }))}
        />
        <Select
          allowClear
          showSearch
          placeholder={t("filters.action")}
          value={action}
          onChange={onFirstPage(setAction)}
          options={actions.map((name) => ({ label: name, value: name }))}
        />
        <Input
          allowClear
          placeholder={t("filters.entityType")}
          value={entityType}
          onChange={(event) => onFirstPage(setEntityType)(event.target.value)}
        />
        <Input
          allowClear
          placeholder={t("filters.userId")}
          value={userId}
          onChange={(event) => onFirstPage(setUserId)(event.target.value)}
        />
        <div className="flex gap-2">
          <RangePicker
            className="w-full"
            value={dateRange}
            onChange={(value) => onFirstPage(setDateRange)(value)}
            placeholder={[t("filters.from"), t("filters.to")]}
          />
          <Button
            icon={<RotateCcw size={16} />}
            disabled={!hasFilters}
            onClick={clearFilters}
            aria-label={t("filters.clear")}
            title={t("filters.clear")}
          />
        </div>
      </div>

      {isError ? (
        <QueryErrorState description={t("loadError")} onRetry={() => refetch()} />
      ) : (
        <Table<ActivityLog>
          rowKey={(record) => `${record.service ?? ""}-${record.id}`}
          columns={columns}
          dataSource={items}
          loading={isLoading || isFetching}
          size="small"
          scroll={{ x: "max-content" }}
          expandable={{
            expandedRowRender: (record) => <ActivityLogDetail log={record} />,
            rowExpandable: (record) =>
              Boolean(record.old_value || record.new_value || record.metadata || record.trace_id),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          locale={{ emptyText: t("empty") }}
        />
      )}
    </div>
  );
};

export default ActivityLogViewer;
