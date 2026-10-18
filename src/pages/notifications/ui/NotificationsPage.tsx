// dizayn-v2: superadmin-notifications-telegram-groups, superadmin-notifications-create-dialog, superadmin-notifications-delete-dialog
import { memo, useCallback, useMemo, useState } from "react";
import { BellOff, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  NotificationGroupTypeBadge,
  NotificationStatusBadge,
  useNotificationMarkets,
  useNotifications,
  type Notification,
} from "../../../entities/notification";
import { NotificationFormModal } from "../../../features/notification-create";
import { useDeleteNotificationConfirm } from "../../../features/notification-delete";
import { NotificationEditModal } from "../../../features/notification-edit";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

const PAGE_SIZES = [10, 20, 50] as const;

/** `.el-stat-icon` 36 px — market belgisi. */
const STAT_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

/**
 * BILDIRISHNOMALAR — marketlarning Telegram guruhlari (`/notifications`, faqat superadmin), dizayn v2.
 * Maketlar: `superadmin-notifications-telegram-groups`, `-create-dialog`, `-delete-dialog`.
 *
 * Sarlavha + «Bildirishnoma qo'shish»; karta «Ulangan guruhlar» (son) — jadval (Market #id · Telegram guruh ID ·
 * Xabar turi · Holat · Sana · tahrirlash/o'chirish), telefonda kartalar; pastda sahifalash.
 * So'rov: `GET /notifications?page&limit`. Ustun saralash strelkalari chizilmaydi — API'da sort yo'q (spec G8).
 *
 * dev (Dilshod, 8c6c07b) xulqlari: «Holat» ustuni (Faol / Nofaol + «Bot guruhdan chiqarilgan — qayta ulang»,
 * 9HIaV80X); market nomi `GET /markets` dan (`GET /notifications` qatorida faqat `market_id` — nom topilmasa
 * sarlavhada `#id`, ostida takrorlanmaydi); qo'shish — bir martalik havola oynasi (6jXw0DDr).
 */
const NotificationsPage = () => {
  const { t, i18n } = useTranslation("notificationGroups");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Notification | null>(null);
  const confirmDelete = useDeleteNotificationConfirm();
  const { getName } = useNotificationMarkets();

  const query = useNotifications({ page, limit }, { silentError: true });
  const { data, isLoading, isError, error, refetch } = query;
  const total = data?.total;

  // Oxirgi sahifadagi yagona guruh o'chirilsa sahifa bo'shab qoladi («Hali guruh ulanmagan» chiqmasin) — mavjud
  // oxirgi sahifaga qaytiladi (holat render paytida, effektsiz).
  if (data && data.data.length === 0 && data.total > 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(data.total / limit));
    if (lastPage < page) setPage(lastPage);
  }

  const groupName = useCallback((row: Notification) => t(`groupName.${row.group_type}`), [t]);
  const marketName = useCallback(
    (row: Notification) => row.market_name ?? getName(row.market_id) ?? `#${row.market_id}`,
    [getName],
  );
  /** Nom topilmasa sarlavhada `#id` turadi — ostida takrorlanmaydi. */
  const hasName = useCallback(
    (row: Notification) => Boolean(row.market_name ?? getName(row.market_id)),
    [getName],
  );
  const dateTime = useCallback(
    (value: string) => formatDateTimeLocalized(value, { language }),
    [language],
  );

  const typeBadge = useCallback(
    (row: Notification) => <NotificationGroupTypeBadge type={row.group_type} />,
    [],
  );

  /** «Nofaol» — bot guruhdan chiqarilgan yoki guruhga yetib bo'lmaydi: qayta ulash kerak (izoh bilan). */
  const inactiveHint = useCallback(
    (row: Notification) =>
      row.is_active ? null : (
        <span className="text-xs text-text-muted">{t("status.inactiveHint")}</span>
      ),
    [t],
  );

  const rowActions = useCallback(
    (row: Notification, layout: "row" | "column") => {
      const market = marketName(row);
      const names = { market, group: groupName(row) };
      return (
        <div
          className={
            layout === "row"
              ? "flex items-center justify-end gap-1"
              : "flex flex-col items-center gap-1"
          }
        >
          <IconButton
            size="sm"
            icon={Pencil}
            label={t("editLabel", names)}
            aria-haspopup="dialog"
            onClick={() => setEditTarget(row)}
          />
          <IconButton
            size="sm"
            variant="danger"
            icon={Trash2}
            label={t("deleteLabel", names)}
            aria-haspopup="dialog"
            onClick={() => void confirmDelete(row, market)}
          />
        </div>
      );
    },
    [confirmDelete, groupName, marketName, t],
  );

  const marketCell = useCallback(
    (row: Notification) => (
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={STAT_ICON}>
          <Store size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold text-text">{marketName(row)}</span>
          {hasName(row) ? (
            <span className="text-[13px] text-text-muted tabular-nums">#{row.market_id}</span>
          ) : null}
        </span>
      </div>
    ),
    [hasName, marketName],
  );

  const columns = useMemo<DataTableColumn<Notification>[]>(
    () => [
      { id: "market", header: t("columns.market"), cell: marketCell },
      {
        id: "group",
        header: t("columns.groupId"),
        cellClassName: "whitespace-nowrap tabular-nums",
        cell: (row) => (
          <>
            {row.group_id}
            {/* Planshetda «Sana» ustuni yashirin — sana guruh ID ostida (maket `.el-show-tablet`). */}
            <span className="hidden text-[13px] text-text-muted max-lg:block">
              {dateTime(row.created_at)}
            </span>
          </>
        ),
      },
      { id: "type", header: t("columns.type"), cell: typeBadge },
      {
        id: "status",
        header: t("columns.status"),
        className: "min-w-[120px] max-w-[200px]",
        cell: (row) => (
          <span className="flex flex-col items-start gap-1">
            <NotificationStatusBadge active={row.is_active} />
            {inactiveHint(row)}
          </span>
        ),
      },
      {
        id: "date",
        header: t("columns.date"),
        hideBelow: "lg",
        cellClassName: "whitespace-nowrap tabular-nums",
        cell: (row) => dateTime(row.created_at),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("columns.actions")}</span>,
        className: "w-[88px]",
        cell: (row) => rowActions(row, "row"),
      },
    ],
    [dateTime, inactiveHint, marketCell, rowActions, t, typeBadge],
  );

  // Telefon kartasi (maket `.el-list-item`): belgi, «Market #id», guruh ID, turi + sana; o'ngda ikki ikonka tugma (44 px).
  const renderCard = useCallback(
    (row: Notification) => (
      <div className="flex min-w-0 items-start gap-3 px-4 py-3">
        <span aria-hidden="true" className={STAT_ICON}>
          <Store size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-text">{marketName(row)}</span>
            {hasName(row) ? (
              <span className="text-[13px] text-text-muted tabular-nums">#{row.market_id}</span>
            ) : null}
          </span>
          <span className="text-sm text-text tabular-nums [overflow-wrap:anywhere]">
            {row.group_id}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {typeBadge(row)}
            <NotificationStatusBadge active={row.is_active} />
            <span className="text-xs text-text-muted tabular-nums">{dateTime(row.created_at)}</span>
          </span>
          {inactiveHint(row)}
        </div>
        {rowActions(row, "column")}
      </div>
    ),
    [dateTime, hasName, inactiveHint, marketName, rowActions, typeBadge],
  );

  const changeLimit = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button leftIcon={Plus} aria-haspopup="dialog" onClick={() => setIsCreateOpen(true)}>
            {t("add")}
          </Button>
        }
      />

      <Card
        padding="none"
        title={t("list.title")}
        titleAddon={
          total !== undefined ? <Badge>{formatNumberLocalized(total, { language })}</Badge> : null
        }
        actions={
          <span className="text-right text-[13px] text-text-muted max-lg:max-w-[300px] max-md:hidden">
            {t("list.hint")}
          </span>
        }
        footer={
          data && data.total > 0 ? (
            <Pagination
              page={data.page || page}
              pageSize={data.limit || limit}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={changeLimit}
              pageSizeOptions={PAGE_SIZES}
              summary={(range) => t("list.pagination", { ...range, count: data.total })}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={{ data: data?.data, isLoading, isError, error, refetch }}
          loadingLabel={t("list.loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[
                t("columns.market"),
                t("columns.groupId"),
                t("columns.type"),
                t("columns.status"),
                t("columns.date"),
              ]}
              rows={6}
            />
          }
          empty={
            <EmptyState
              icon={BellOff}
              title={t("list.emptyTitle")}
              description={t("list.emptyDescription")}
              action={
                <Button
                  variant="secondary"
                  leftIcon={Plus}
                  aria-haspopup="dialog"
                  onClick={() => setIsCreateOpen(true)}
                >
                  {t("add")}
                </Button>
              }
            />
          }
          error={(queryError, retry) => (
            <ErrorState error={queryError} title={t("list.loadError")} onRetry={retry} />
          )}
        >
          {(rows, { isRefetching }) => (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(row) => row.id}
              label={t("list.label")}
              cardsLabel={t("list.cardsLabel")}
              density="tablet-tight"
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>

      <NotificationFormModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <NotificationEditModal
        open={Boolean(editTarget)}
        initialData={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
};

export default memo(NotificationsPage);
