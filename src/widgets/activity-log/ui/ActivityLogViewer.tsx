// dizayn-v2: superadmin-activity-logs-list, superadmin-activity-logs-row-expanded, admin-activity-logs-list, admin-activity-logs-row-expanded
import { useEffect, useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ACTIVITY_SERVICES,
  ActivityActionTag,
  useActivityActionCatalog,
  useActivityLogs,
  type ActivityLog,
} from "../../../entities/activity-log";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  Select,
  TextInput,
  type DataTableColumn,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import {
  actionLabel,
  actorName,
  actorRole,
  buildLogParams,
  countSheetFilters,
  EMPTY_LOG_FILTERS,
  entityName,
  entityRef,
  entityTitle,
  entityTypeLabel,
  hasLogDetails,
  logRowKey,
  serviceLabel,
  type LogFilters,
  type Translate,
} from "../lib/logView";
import ActivityLogDetail from "./ActivityLogDetail";
import { ActivityLogFiltersSheet } from "./ActivityLogFiltersSheet";

/**
 * FAOLIYAT JURNALI (maketlar `superadmin-activity-logs-list`, `-row-expanded`; admin — shu): filtrlar (qidiruv,
 * Xizmat, Amal, Obyekt turi, Foydalanuvchi ID, sana oralig'i, «Filtrlarni tozalash»; telefonda qidiruv + sana +
 * «Filtrlar» varaqasi), `DataTable` ochiladigan qatorlar bilan (`expandable`), `Pagination`.
 *
 * Xulq (avvalgidek): qidiruv 400 ms kechikish bilan, filtr o'zgarsa 1-sahifa, `from` — kun boshi, `to` — kun
 * oxiri (ISO), filtrlar URL'da EMAS.
 */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

const ActivityLogViewer = () => {
  const { t, i18n } = useTranslation(["activityLogs", "ui"]);
  const translate = t as unknown as Translate;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LogFilters>(EMPTY_LOG_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  // Har filtr o'zgarishi — 1-sahifa (hodisa ishlovchisida, effektda emas: kaskad render bo'lmasin).
  const updateFilters = (next: Partial<LogFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  const params = useMemo(
    () => buildLogParams(filters, debouncedSearch, page, PAGE_SIZE),
    [filters, debouncedSearch, page],
  );

  const logsQuery = useActivityLogs(params, { silentError: true });
  const catalogQuery = useActivityActionCatalog();

  const items = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;

  const registry = useMemo(
    () => new Map((catalogQuery.data?.registry ?? []).map((item) => [item.action, item.label] as const)),
    [catalogQuery.data],
  );

  const serviceOptions: SelectOption<string>[] = ACTIVITY_SERVICES.map((service) => ({
    value: service,
    label: serviceLabel(service, translate),
  }));
  const actionOptions: SelectOption<string>[] = useMemo(() => {
    // Guruh nomi: backend `category_label` faqat o'zbekcha — ru/en uchun `categories.<kalit>` tarjimasi.
    const groups = new Map(
      (catalogQuery.data?.registry ?? []).map((item) => {
        const fallback = item.category_label || item.category;
        const groupLabel = item.category ? translate(`categories.${item.category}`, { defaultValue: fallback }) : fallback;
        return [item.action, groupLabel] as const;
      }),
    );
    return (catalogQuery.data?.actions ?? []).map((action) => ({
      value: action,
      label: actionLabel(action, translate, language, registry),
      group: groups.get(action) || undefined,
    }));
  }, [catalogQuery.data, translate, language, registry]);

  const hasFilters = Boolean(
    debouncedSearch ||
      filters.service ||
      filters.action ||
      filters.entityType.trim() ||
      filters.userId.trim() ||
      filters.dateFrom ||
      filters.dateTo,
  );

  const clearFilters = () => {
    setFilters(EMPTY_LOG_FILTERS);
    setDebouncedSearch("");
    setPage(1);
  };

  const toggleRow = (log: ActivityLog, next: boolean) =>
    setExpanded((current) => {
      const copy = new Set(current);
      if (next) copy.add(logRowKey(log));
      else copy.delete(logRowKey(log));
      return copy;
    });

  const timeText = (log: ActivityLog) => (log.created_at ? formatDateTimeLocalized(log.created_at, { language }) : "—");
  const label = (log: ActivityLog) => actionLabel(log.action, translate, language, registry, log.action_meta?.label);
  const objectTitle = (log: ActivityLog) => entityTitle(log, translate) || t("columns.entity");

  const columns: DataTableColumn<ActivityLog>[] = [
    {
      id: "time",
      header: t("columns.time"),
      className: "w-[150px]",
      cell: (log) => <span className="whitespace-nowrap">{timeText(log)}</span>,
    },
    {
      id: "actor",
      header: t("columns.actor"),
      cell: (log) => {
        const role = actorRole(log, translate);
        return (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{actorName(log, translate)}</div>
            {role ? <div className="text-[13px] text-text-muted">{role}</div> : null}
          </>
        );
      },
    },
    {
      id: "action",
      header: t("columns.action"),
      cell: (log) => <ActivityActionTag action={log.action} label={label(log)} />,
    },
    {
      id: "entity",
      header: t("columns.entity"),
      cell: (log) => {
        const name = entityName(log);
        return (
          <>
            <div className="whitespace-nowrap font-semibold text-text">
              {entityTypeLabel(log.entity_type, translate)}{" "}
              {entityRef(log) ? <span className="font-medium text-text-muted">{entityRef(log)}</span> : null}
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
      cell: (log) => (log.service ? <Badge>{serviceLabel(log.service, translate)}</Badge> : "—"),
    },
  ];

  const renderCard = (log: ActivityLog) => {
    const role = actorRole(log, translate);
    const name = entityName(log);
    return (
      <div className="flex min-w-0 flex-col gap-1 py-3 pl-4">
        <span className="flex items-center justify-between gap-2">
          <ActivityActionTag action={log.action} label={label(log)} />
          <span className="whitespace-nowrap text-[13px] text-text-muted">{timeText(log)}</span>
        </span>
        <span className="font-semibold text-text">
          {entityTypeLabel(log.entity_type, translate)}{" "}
          <span className="font-medium text-text-muted">{[entityRef(log), name].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex justify-between gap-2 text-[13px] text-text-muted">
          <span className="min-w-0">{[actorName(log, translate), role].filter(Boolean).join(" · ")}</span>
          {log.service ? <span className="shrink-0">{serviceLabel(log.service, translate)}</span> : null}
        </span>
      </div>
    );
  };

  const all = t("filters.all");
  const serviceSelect = (
    <Select
      options={[{ value: "", label: all }, ...serviceOptions]}
      value={filters.service}
      onChange={(next) => updateFilters({ service: next ?? "" })}
      placeholder={all}
      inlineLabel={t("filters.service")}
      aria-label={t("filters.serviceAria")}
    />
  );
  const actionSelect = (
    <Select
      options={[{ value: "", label: all }, ...actionOptions]}
      value={filters.action}
      onChange={(next) => updateFilters({ action: next ?? "" })}
      placeholder={all}
      inlineLabel={t("filters.action")}
      aria-label={t("filters.actionAria")}
      searchable={actionOptions.length > 8}
      loading={catalogQuery.isLoading}
    />
  );
  const dateRange = (
    <DateRange
      value={{ from: filters.dateFrom, to: filters.dateTo }}
      onChange={({ from, to }) => updateFilters({ dateFrom: from, dateTo: to })}
      placeholder={t("filters.dateRange")}
      className="min-w-0 flex-[1_1_auto]"
      triggerClassName="whitespace-nowrap"
    />
  );
  const sheetCount = countSheetFilters(filters);

  return (
    <Card
      padding="none"
      aria-label={t("cardLabel")}
      footer={
        total > 0 && !logsQuery.isError ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            summary={(range) => t("summary", range)}
          />
        ) : undefined
      }
    >
      <div
        role="search"
        aria-label={t("filters.region")}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3 px-5 py-4 max-md:px-4"
      >
        <TextInput
          mode="search"
          value={filters.search}
          onValueChange={(search) => updateFilters({ search })}
          placeholder={t("filters.search")}
          aria-label={t("filters.search")}
        />
        {isPhone ? null : (
          <>
            {serviceSelect}
            {actionSelect}
            <TextInput
              value={filters.entityType}
              onValueChange={(entityType) => updateFilters({ entityType })}
              placeholder={t("filters.entityType")}
              aria-label={t("filters.entityTypeLabel")}
            />
            <TextInput
              inputMode="numeric"
              value={filters.userId}
              onValueChange={(userId) => updateFilters({ userId })}
              placeholder={t("filters.userId")}
              aria-label={t("filters.userId")}
            />
          </>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {dateRange}
          {isPhone ? (
            <Button
              variant="secondary"
              leftIcon={ListFilter}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className="flex-[1_0_auto]"
            >
              <span className="inline-flex items-center gap-2">
                {t("filters.button", { ns: "ui" })}
                {sheetCount > 0 ? (
                  <span className={COUNT_PILL}>{formatNumberLocalized(sheetCount, { language })}</span>
                ) : null}
              </span>
            </Button>
          ) : hasFilters ? (
            <span className="flex-none">
              <Button variant="link" size="sm" onClick={clearFilters}>
                {t("filters.clear")}
              </Button>
            </span>
          ) : null}
        </div>
      </div>

      <QueryBoundary
        query={logsQuery}
        skeleton="table"
        isEmpty={() => items.length === 0}
        empty={
          hasFilters ? (
            <EmptyState
              title={t("emptyFiltered")}
              description={t("emptyFilteredHint")}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {t("filters.clear")}
                </Button>
              }
            />
          ) : (
            <EmptyState title={t("empty")} description={t("emptyHint")} />
          )
        }
        error={(error, retry) => (
          <ErrorState error={error} title={t("loadError")} onRetry={retry} />
        )}
        className="border-t border-border"
      >
        {(_, { isRefetching }) => (
          <DataTable
            rows={items}
            columns={columns}
            getRowKey={logRowKey}
            label={t("cardLabel")}
            busy={isRefetching}
            onRowClick={(log) => {
              if (hasLogDetails(log)) toggleRow(log, !expanded.has(logRowKey(log)));
            }}
            renderCard={renderCard}
            expandable={{
              isExpanded: (log) => expanded.has(logRowKey(log)),
              onToggle: toggleRow,
              canExpand: hasLogDetails,
              render: (log) => <ActivityLogDetail log={log} />,
              toggleLabel: (log, open) => t(open ? "toggleClose" : "toggleOpen", { object: objectTitle(log) }),
            }}
          />
        )}
      </QueryBoundary>

      {isPhone ? (
        <ActivityLogFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initial={filters}
          serviceOptions={serviceOptions}
          actionOptions={actionOptions}
          actionsLoading={catalogQuery.isLoading}
          onApply={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
      ) : null}
    </Card>
  );
};

export default ActivityLogViewer;
