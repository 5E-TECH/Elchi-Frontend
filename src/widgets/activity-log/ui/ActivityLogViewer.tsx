// dizayn-v2: superadmin-activity-logs-list, superadmin-activity-logs-row-expanded, admin-activity-logs-list, admin-activity-logs-row-expanded
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ActivityActionBadge,
  useActivityActions,
  useActivityLogs,
  type ActivityActionMeta,
  type ActivityLog,
  type ActivityLogParams,
} from "../../../entities/activity-log";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { useActivityLabels } from "../model/useActivityLabels";
import { hasActivityDetail } from "../model/activityDetail";
import { EMPTY_ACTIVITY_FILTERS, hasActivityFilters, type ActivityLogFilterValues } from "../model/activityFilters";
import ActivityLogDetail from "./ActivityLogDetail";
import ActivityLogFilters from "./ActivityLogFilters";

/**
 * Faoliyat jurnali — dizayn v2 (maketlar `superadmin-activity-logs-list`, `-row-expanded`; admin ham shu).
 * Bitta karta: filtrlar → jadval (telefonda ro'yxat qatorlari) → sahifalash. Qator «›» bilan ochiladi:
 * maydon o'zgarishlari va qo'shimcha ma'lumot (`ActivityLogDetail`); tafsiloti yo'q qatorda tugma yo'q.
 * «Amal» — `action_meta` badge'i (y8CxCtcK), «Kim» — ism + rol (topilmasa «#7 (topilmadi)», «Tizim»).
 */

const PAGE_SIZE = 20;

/** `YYYY-MM-DD` (mahalliy kun) → kun boshi / oxiri ISO (avvalgi `startOf("day")` / `endOf("day")` kabi). */
const dayStartIso = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const dayEndIso = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

const rowKey = (log: ActivityLog) => `${log.service ?? ""}-${log.id}`;

const ActivityLogViewer = () => {
  const { t } = useTranslation("activityLogs");
  const labels = useActivityLabels();
  const { language } = labels;

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ActivityLogFilterValues>(EMPTY_ACTIVITY_FILTERS);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const params = useMemo<ActivityLogParams>(() => {
    const next: ActivityLogParams = { page, limit: PAGE_SIZE };
    if (filters.search) next.search = filters.search;
    if (filters.service) next.service = filters.service;
    if (filters.action) next.action = filters.action;
    if (filters.entityType.trim()) next.entity_type = labels.entityTypeParam(filters.entityType);
    if (filters.userId.trim()) next.user_id = filters.userId.trim();
    if (filters.dateFrom) next.from = dayStartIso(filters.dateFrom);
    if (filters.dateTo) next.to = dayEndIso(filters.dateTo);
    return next;
  }, [filters, labels, page]);

  const logsQuery = useActivityLogs(params);
  const catalogQuery = useActivityActions();
  const registry = useMemo(
    () => new Map<string, ActivityActionMeta>((catalogQuery.data?.registry ?? []).map((item) => [item.action, item])),
    [catalogQuery.data],
  );

  const items = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const filtered = hasActivityFilters(filters);

  // Har filtr o'zgarishi birinchi sahifaga qaytaradi, ochiq qator yopiladi.
  const changeFilters = (patch: Partial<ActivityLogFilterValues>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
    setExpandedKey(null);
  };
  // Filtr bloki qayta yaratiladi: yozilayotgan qidiruvning kechikkan taymeri (400 ms) tozalashni bekor qilmaydi.
  const [filtersKey, setFiltersKey] = useState(0);
  const clearFilters = () => {
    setFilters(EMPTY_ACTIVITY_FILTERS);
    setFiltersKey((key) => key + 1);
    setPage(1);
    setExpandedKey(null);
  };
  const changePage = (next: number) => {
    setPage(next);
    setExpandedKey(null);
  };

  const target = (log: ActivityLog) => [labels.entityType(log.entity_type), labels.entityId(log)].filter(Boolean).join(" ");

  const toggleButton = (log: ActivityLog) => {
    if (!hasActivityDetail(log)) return <span className="sr-only">{t("detail.none")}</span>;
    const open = expandedKey === rowKey(log);
    return (
      <IconButton
        size="sm"
        icon={open ? ChevronDown : ChevronRight}
        aria-expanded={open}
        label={t(open ? "detail.collapse" : "detail.expand", { target: target(log) })}
        onClick={() => setExpandedKey(open ? null : rowKey(log))}
      />
    );
  };

  const time = (log: ActivityLog) => formatDateTimeLocalized(log.created_at, { language });

  const columns: DataTableColumn<ActivityLog>[] = [
    {
      id: "detail",
      header: <span className="sr-only">{t("columns.detail")}</span>,
      className: "w-[52px] pr-0",
      cell: toggleButton,
    },
    {
      id: "time",
      header: t("columns.time"),
      className: "w-[150px] whitespace-nowrap",
      cell: time,
    },
    {
      id: "actor",
      header: t("columns.actor"),
      cell: (log) => {
        const role = labels.role(log.actor?.role || log.user_role);
        return (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{labels.actorName(log)}</div>
            {role ? <div className="whitespace-nowrap text-[13px] text-text-muted">{role}</div> : null}
          </>
        );
      },
    },
    {
      id: "action",
      header: t("columns.action"),
      cell: (log) => <ActivityActionBadge action={log.action} meta={log.action_meta} registry={registry} />,
    },
    {
      id: "entity",
      header: t("columns.entity"),
      cell: (log) => {
        const name = labels.entityName(log);
        return (
          <>
            <div className="whitespace-nowrap font-semibold text-text">
              {labels.entityType(log.entity_type)}{" "}
              <span className="font-medium text-text-muted">{labels.entityId(log)}</span>
            </div>
            {name ? <div className="text-[13px] text-text-muted">{name}</div> : null}
          </>
        );
      },
    },
    {
      id: "service",
      header: t("columns.service"),
      hideBelow: "lg",
      cell: (log) => (log.service ? <Badge>{labels.service(log.service)}</Badge> : <span className="text-text-muted">—</span>),
    },
  ];

  const renderCard = (log: ActivityLog) => {
    const role = labels.role(log.actor?.role || log.user_role);
    const name = labels.entityName(log);
    const expandable = hasActivityDetail(log);
    return (
      // Tugma bo'lsa o'ng chekka 4 px (maket `.el-list-item` `padding-right: 4px`), bo'lmasa — 16 px.
      <div className={`flex min-w-0 items-start gap-2 py-3 pl-4 text-sm ${expandable ? "pr-1" : "pr-4"}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Uzun fe'l yorlig'i vaqtni tugma ustiga surmaydi — qator o'raladi. */}
          <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <ActivityActionBadge action={log.action} meta={log.action_meta} registry={registry} />
            <span className="whitespace-nowrap text-[13px] text-text-muted">{time(log)}</span>
          </span>
          <span className="min-w-0 font-semibold text-text">
            {labels.entityType(log.entity_type)}{" "}
            <span className="font-medium text-text-muted">{[labels.entityId(log), name].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="flex min-w-0 justify-between gap-2 text-[13px] text-text-muted">
            <span className="min-w-0">{[labels.actorName(log), role].filter(Boolean).join(" · ")}</span>
            {log.service ? <span className="whitespace-nowrap">{labels.service(log.service)}</span> : null}
          </span>
        </div>
        {expandable ? <div className="-mt-1 shrink-0">{toggleButton(log)}</div> : null}
      </div>
    );
  };

  const query = {
    data: logsQuery.isLoading || (logsQuery.isError && items.length === 0) ? undefined : items,
    isLoading: logsQuery.isLoading,
    isError: logsQuery.isError,
    error: logsQuery.error,
    refetch: () => void logsQuery.refetch(),
  };

  return (
    <Card
      padding="none"
      aria-label={t("cardLabel")}
      footer={
        total > 0 && items.length > 0 ? (
          <Pagination
            page={logsQuery.data?.page ?? page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={changePage}
            summary={(range) => t("summary", range)}
          />
        ) : undefined
      }
    >
      <ActivityLogFilters
        key={filtersKey}
        values={filters}
        onChange={changeFilters}
        onClear={clearFilters}
        catalog={catalogQuery.data}
        catalogLoading={catalogQuery.isLoading}
        labels={labels}
      />
      <QueryBoundary
        query={query}
        keepPreviousData={false}
        error={(error, retry) => (
          <ErrorState className="border-t border-border" error={error} onRetry={retry} />
        )}
        loading={
          <SkeletonTable
            framed={false}
            className="border-t border-border"
            columns={[t("columns.time"), t("columns.actor"), t("columns.action"), t("columns.entity"), t("columns.service")]}
          />
        }
        empty={
          <EmptyState
            className="border-t border-border"
            icon={ScrollText}
            title={t("empty")}
            description={filtered ? t("emptyFiltered") : undefined}
            action={
              filtered ? (
                <Button variant="secondary" onClick={clearFilters}>
                  {t("filters.clear")}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={rowKey}
            label={t("cardLabel")}
            cardsLabel={t("cardLabel")}
            renderCard={renderCard}
            renderExpanded={(log) =>
              expandedKey === rowKey(log) ? <ActivityLogDetail log={log} labels={labels} /> : null
            }
            busy={logsQuery.isFetching && !logsQuery.isLoading}
            className="border-t border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

export default ActivityLogViewer;
