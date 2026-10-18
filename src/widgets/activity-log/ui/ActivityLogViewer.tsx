// dizayn-v2: superadmin-activity-logs-list, superadmin-activity-logs-row-expanded, admin-activity-logs-list, admin-activity-logs-row-expanded
import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ActivityActionBadge,
  useActivityActions,
  useActivityLogs,
  type ActivityActionMeta,
  type ActivityLog,
} from "../../../entities/activity-log";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { useActivityLabels } from "../model/useActivityLabels";
import { hasActivityDetail } from "../model/activityDetail";
import {
  buildActivityLogParams,
  EMPTY_ACTIVITY_FILTERS,
  hasActivityFilters,
  type ActivityLogFilterValues,
} from "../model/activityFilters";
import ActivityLogDetail from "./ActivityLogDetail";
import ActivityLogFilters from "./ActivityLogFilters";

/**
 * FAOLIYAT JURNALI (maketlar `superadmin-activity-logs-list`, `-row-expanded`; admin — shu). Bitta karta:
 * filtrlar (`ActivityLogFilters`; telefonda qidiruv + sana + «Filtrlar» varaqasi) → `DataTable` (telefonda
 * kartalar) → `Pagination`. Qator `DataTable expandable` bilan ochiladi (chevron ustuni, `aria-controls`):
 * maydon o'zgarishlari va qo'shimcha ma'lumot (`ActivityLogDetail`); tafsiloti yo'q qatorda chevron yo'q.
 * Bir vaqtda bitta qator ochiq; filtr yoki sahifa almashsa yopiladi.
 *
 * «Amal» — `action_meta` badge'i (y8CxCtcK), «Kim» — ism + rol (topilmasa «#7 (topilmadi)», «Tizim»).
 * Xulq: qidiruv 400 ms kechikish bilan (filtr blokida), filtr o'zgarsa 1-sahifa, `from` — kun boshi, `to` — kun
 * oxiri (ISO), filtrlar URL'da EMAS. Xato sahifada chiziladi — global xabar takrorlanmaydi (`silentError`).
 */

const PAGE_SIZE = 20;

const rowKey = (log: ActivityLog) => `${log.service ?? ""}-${log.id}`;

const ActivityLogViewer = () => {
  const { t } = useTranslation("activityLogs");
  const labels = useActivityLabels();
  const { language } = labels;

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ActivityLogFilterValues>(EMPTY_ACTIVITY_FILTERS);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const params = useMemo(
    () => buildActivityLogParams(filters, page, PAGE_SIZE, labels.entityTypeParam),
    [filters, labels, page],
  );

  const logsQuery = useActivityLogs(params, { silentError: true });
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

  const toggleRow = (log: ActivityLog, next: boolean) => setExpandedKey(next ? rowKey(log) : null);

  const time = (log: ActivityLog) => (log.created_at ? formatDateTimeLocalized(log.created_at, { language }) : "—");
  const actionBadge = (log: ActivityLog) => (
    <ActivityActionBadge action={log.action} meta={log.action_meta} registry={registry} label={labels.action(log.action)} />
  );

  const columns: DataTableColumn<ActivityLog>[] = [
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
      cell: actionBadge,
    },
    {
      id: "entity",
      header: t("columns.entity"),
      cell: (log) => {
        const name = labels.entityName(log);
        const id = labels.entityId(log);
        return (
          <>
            <div className="whitespace-nowrap font-semibold text-text">
              {labels.entityType(log.entity_type)}{" "}
              {id ? <span className="font-medium text-text-muted">{id}</span> : null}
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

  // Telefon kartasi; chevron (44 px) va ochilgan panel — `DataTable` da (kartaning o'ng tomoni / ostida).
  const renderCard = (log: ActivityLog) => {
    const role = labels.role(log.actor?.role || log.user_role);
    const name = labels.entityName(log);
    return (
      <div className="flex min-w-0 flex-col gap-1 py-3 pl-4 text-sm">
        {/* Uzun fe'l yorlig'i vaqtni chevron ustiga surmaydi — qator o'raladi. */}
        <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          {actionBadge(log)}
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
        total > 0 && items.length > 0 && !logsQuery.isError ? (
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
          <ErrorState className="border-t border-border" error={error} title={t("loadError")} onRetry={retry} />
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
            description={filtered ? t("emptyFiltered") : t("emptyHint")}
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
            onRowClick={(log) => {
              if (hasActivityDetail(log)) toggleRow(log, expandedKey !== rowKey(log));
            }}
            expandable={{
              isExpanded: (log) => expandedKey === rowKey(log),
              onToggle: toggleRow,
              canExpand: hasActivityDetail,
              render: (log) => <ActivityLogDetail log={log} labels={labels} />,
              toggleLabel: (log, open) => t(open ? "detail.collapse" : "detail.expand", { target: labels.entityTitle(log) }),
            }}
            busy={logsQuery.isFetching && !logsQuery.isLoading}
            className="border-t border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

export default ActivityLogViewer;
