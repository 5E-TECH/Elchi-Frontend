// dizayn-v2: superadmin-notifications-telegram-groups
import { useCallback, useMemo, useState } from "react";
import { Pencil, Send, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  NotificationGroupTypeBadge,
  NotificationStatusBadge,
  useNotificationMarkets,
  useNotifications,
  type Notification,
} from "../../../entities/notification";
import { DeleteNotificationButton } from "../../../features/notification-delete";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Card,
  DataTable,
  EmptyState,
  IconButton,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

interface NotificationTableProps {
  onEdit: (record: Notification) => void;
}

const DEFAULT_LIMIT = 10;

/** Maket `.el-stat-icon`: neytral kvadrat, `Store` ikonka. */
const MarketIcon = () => (
  <span
    aria-hidden="true"
    className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
  >
    <Store size={18} />
  </span>
);

/** Maket `.el-tab-count` — karta sarlavhasi yonidagi son. */
const CountBadge = ({ value }: { value: string }) => (
  <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted">
    {value}
  </span>
);

/**
 * «Ulangan guruhlar» kartasi (maket `superadmin-notifications-telegram-groups`): jadval (planshetda «Sana»
 * guruh ID ostida), telefonda kartalar, pastda sahifalash. Saralash yo'q — `GET /notifications` faqat
 * `createdAt DESC` qaytaradi (saralash parametri yo'q).
 */
const NotificationTable = ({ onEdit }: NotificationTableProps) => {
  const { t } = useTranslation("notifications");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const query = useNotifications({ page, limit });
  const { getName } = useNotificationMarkets();

  const total = query.data?.total ?? 0;

  const marketName = useCallback(
    (row: Notification) => row.market_name ?? getName(row.market_id) ?? `#${row.market_id}`,
    [getName],
  );
  /** Nom topilmasa sarlavhada `#id` turadi — ostida takrorlanmaydi. */
  const hasName = useCallback((row: Notification) => Boolean(row.market_name ?? getName(row.market_id)), [getName]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value), []);

  const status = useCallback(
    (row: Notification) => (
      <span className="flex flex-col items-start gap-1">
        <NotificationStatusBadge active={row.is_active} />
        {row.is_active ? null : (
          <span className="text-xs text-text-muted">{t("telegramGroups.status.inactiveHint")}</span>
        )}
      </span>
    ),
    [t],
  );

  const actions = useCallback(
    (row: Notification, size: "sm" | "lg") => {
      const name = marketName(row);
      const type = t(`telegramGroups.typeGroup.${row.group_type}`);
      return (
        <>
          <IconButton
            size={size}
            icon={Pencil}
            label={t("telegramGroups.actions.editLabel", { market: name, type })}
            aria-haspopup="dialog"
            onClick={() => onEdit(row)}
          />
          <DeleteNotificationButton notification={row} marketName={name} size={size} />
        </>
      );
    },
    [marketName, onEdit, t],
  );

  const columns = useMemo<DataTableColumn<Notification>[]>(
    () => [
      {
        id: "market",
        header: t("telegramGroups.columns.market"),
        cell: (row) => (
          <div className="flex items-center gap-3">
            <MarketIcon />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold whitespace-nowrap text-text">{marketName(row)}</span>
              {hasName(row) ? <span className="text-[13px] whitespace-nowrap text-text-muted">#{row.market_id}</span> : null}
            </span>
          </div>
        ),
      },
      {
        id: "group_id",
        header: t("telegramGroups.columns.groupId"),
        className: "whitespace-nowrap",
        cell: (row) => (
          <span className="flex flex-col">
            <span className="tabular-nums">{row.group_id}</span>
            {/* Planshetda «Sana» ustuni yashirin — sana shu yerda (maket). */}
            <span className="hidden text-[13px] text-text-muted max-lg:block">{dateTime(row.created_at)}</span>
          </span>
        ),
      },
      {
        id: "group_type",
        header: t("telegramGroups.columns.type"),
        cell: (row) => <NotificationGroupTypeBadge type={row.group_type} />,
      },
      {
        id: "status",
        header: t("telegramGroups.columns.status"),
        className: "min-w-[120px] max-w-[200px]",
        cell: status,
      },
      {
        id: "created_at",
        header: t("telegramGroups.columns.date"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cellClassName: "text-text-muted",
        cell: (row) => dateTime(row.created_at),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("telegramGroups.columns.actions")}</span>,
        className: "w-[104px]",
        cell: (row) => <div className="flex justify-end gap-1">{actions(row, "sm")}</div>,
      },
    ],
    [actions, dateTime, hasName, marketName, status, t],
  );

  const renderCard = useCallback(
    (row: Notification) => (
      <div className="flex items-start gap-3 py-3 pr-2 pl-4">
        <MarketIcon />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 font-semibold text-text">{marketName(row)}</span>
            {hasName(row) ? <span className="text-[13px] whitespace-nowrap text-text-muted">#{row.market_id}</span> : null}
          </span>
          <span className="text-[13px] text-text tabular-nums">{row.group_id}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <NotificationGroupTypeBadge type={row.group_type} />
            <NotificationStatusBadge active={row.is_active} />
            <span className="text-xs whitespace-nowrap text-text-subtle">{dateTime(row.created_at)}</span>
          </span>
          {row.is_active ? null : (
            <span className="text-xs text-text-muted">{t("telegramGroups.status.inactiveHint")}</span>
          )}
        </span>
        <div className="-my-1 flex flex-none flex-col">{actions(row, "lg")}</div>
      </div>
    ),
    [actions, dateTime, hasName, marketName, t],
  );

  const skeletonColumns = useMemo(
    () => [
      t("telegramGroups.columns.market"),
      t("telegramGroups.columns.groupId"),
      t("telegramGroups.columns.type"),
      t("telegramGroups.columns.status"),
      t("telegramGroups.columns.date"),
    ],
    [t],
  );

  return (
    <Card
      padding="none"
      title={t("telegramGroups.listTitle")}
      titleAddon={query.data ? <CountBadge value={formatNumberLocalized(total)} /> : null}
      // Izoh: desktopda sarlavha qatorining o'ng tomonida, planshetda sarlavha ostida, telefonda yo'q (maket).
      description={<span className="hidden max-lg:block max-md:hidden">{t("telegramGroups.listHint")}</span>}
      actions={<p className="text-[13px] text-text-muted max-lg:hidden">{t("telegramGroups.listHint")}</p>}
      footer={
        total > 0 ? (
          <Pagination
            page={page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            summary={(range) => t("telegramGroups.paginationSummary", { ...range, count: total })}
          />
        ) : undefined
      }
    >
      <QueryBoundary
        query={query}
        loading={<SkeletonTable framed={false} columns={skeletonColumns} />}
        empty={
          <EmptyState icon={Send} title={t("telegramGroups.emptyTitle")} description={t("telegramGroups.emptyHint")} />
        }
      >
        {(data, { isRefetching }) => (
          <DataTable
            rows={data.data}
            columns={columns}
            getRowKey={(row) => row.id}
            label={t("telegramGroups.listLabel")}
            density="tablet-tight"
            renderCard={renderCard}
            busy={isRefetching}
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

export default NotificationTable;
