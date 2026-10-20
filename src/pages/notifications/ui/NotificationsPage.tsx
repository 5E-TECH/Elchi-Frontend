// dizayn-v2: superadmin-notifications-telegram-groups, superadmin-notifications-row-menu, superadmin-notifications-row-menu-inactive, superadmin-notifications-empty, superadmin-notifications-loading, superadmin-notifications-error, superadmin-notifications-create-dialog, superadmin-notifications-delete-dialog
import { memo, useCallback, useMemo, useState } from "react";
import { Bell, BellOff, Plus, Store, Trash2 } from "lucide-react";
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
import { useToggleNotificationConfirm } from "../../../features/notification-toggle";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { NotificationRowMenu, type NotificationRowMenuItem } from "./NotificationRowMenu";

const PAGE_SIZES = [10, 20, 50] as const;

/** `.el-stat-icon` 36 px — market belgisi. */
const STAT_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

/**
 * BILDIRISHNOMALAR — marketlarning Telegram guruhlari (`/notifications`, superadmin va admin — ega NG-S2), dizayn v2.
 * Maketlar: `{superadmin,admin}-notifications-telegram-groups`, `-row-menu`, `-row-menu-inactive`, `-empty`,
 * `-loading`, `-error`, `-create-dialog`, `-deactivate-dialog`, `-activate-dialog`, `-delete-dialog`.
 *
 * Sarlavha + «Bildirishnoma qo'shish»; karta «Ulangan guruhlar» (son) — jadval (Market #id · Telegram guruh ID ·
 * Xabar turi · Holat · Sana · kebab 64 px), telefonda kartalar; pastda sahifalash. Planshetda (< 1024) «Xabar turi»
 * va «Sana» ustunlari yashirin: tur — market nomi ostida, sana — guruh ID ostida (maket `.el-show-tablet`).
 * So'rov: `GET /notifications?page&limit`. Ustun saralash strelkalari chizilmaydi — API'da sort yo'q (spec G8).
 *
 * Qator menyusi (`NotificationRowMenu`, NG-S4: «Tahrirlash» — qo'lda guruh ID — olib tashlandi): faol guruhda
 * «Nofaol qilish», nofaolida «Faollashtirish», so'ng «O'chirish» — har biri tasdiq oynasi orqali
 * (`features/notification-toggle`, `features/notification-delete`).
 *
 * «Holat» ustuni: Faol / Nofaol + umumiy neytral izoh (D1). Nofaollik sababi (`inactive_reason`) API'da yo'q —
 * «bot chiqarilgan» deb yozilmaydi (sababga qarab matn — NG-C). Market nomi `GET /markets` dan (`GET /notifications`
 * qatorida faqat `market_id` — nom topilmasa sarlavhada `#id`, ostida takrorlanmaydi); qo'shish — bir martalik
 * havola oynasi (6jXw0DDr).
 */
const NotificationsPage = () => {
  const { t, i18n } = useTranslation("notificationGroups");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const confirmDelete = useDeleteNotificationConfirm();
  const confirmToggle = useToggleNotificationConfirm();
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

  /** «Nofaol» ostidagi umumiy neytral izoh (D1) — sabab API'da yo'q, «bot chiqarilgan» deb yozilmaydi. */
  const inactiveHint = useCallback(
    (row: Notification) =>
      row.is_active ? null : (
        <span className="text-xs text-text-muted">{t("status.inactiveHint")}</span>
      ),
    [t],
  );

  const statusLine = useCallback(
    (row: Notification) => (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <NotificationStatusBadge active={row.is_active} />
        {inactiveHint(row)}
      </span>
    ),
    [inactiveHint],
  );

  const rowMenu = useCallback(
    (row: Notification) => {
      const market = marketName(row);
      const items: NotificationRowMenuItem[] = [
        row.is_active
          ? {
              key: "deactivate",
              label: t("rowMenu.deactivate"),
              icon: BellOff,
              onSelect: () => void confirmToggle(row, market),
            }
          : {
              key: "activate",
              label: t("rowMenu.activate"),
              icon: Bell,
              onSelect: () => void confirmToggle(row, market),
            },
        {
          key: "delete",
          label: t("rowMenu.delete"),
          icon: Trash2,
          danger: true,
          onSelect: () => void confirmDelete(row, market),
        },
      ];
      return (
        <NotificationRowMenu
          label={t("rowMenu.label", { market, group: groupName(row) })}
          title={market}
          titleAddon={hasName(row) ? `#${row.market_id}` : null}
          meta={`${t(`type.${row.group_type}`)} · ${row.group_id}`}
          status={row.is_active ? null : statusLine(row)}
          items={items}
        />
      );
    },
    [confirmDelete, confirmToggle, groupName, hasName, marketName, statusLine, t],
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
          {/* Planshetda «Xabar turi» ustuni yashirin — tur market nomi ostida (maket `.el-show-tablet`). */}
          <span className="mt-1 hidden max-lg:block">{typeBadge(row)}</span>
        </span>
      </div>
    ),
    [hasName, marketName, typeBadge],
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
      { id: "type", header: t("columns.type"), hideBelow: "lg", cell: typeBadge },
      {
        id: "status",
        header: t("columns.status"),
        className: "min-w-[120px] max-w-[260px]",
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
        className: "w-16",
        cellClassName: "text-right",
        cell: rowMenu,
      },
    ],
    [dateTime, inactiveHint, marketCell, rowMenu, t, typeBadge],
  );

  // Telefon kartasi (maket `.el-list-item`): belgi, «Market #id», guruh ID, turi + holat + sana, nofaolda izoh;
  // o'ngda kebab (44 px) — pastki varaqa.
  const renderCard = useCallback(
    (row: Notification) => (
      <div className="flex min-w-0 items-start gap-3 py-3 pr-2 pl-4">
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
        <span className="-my-1 shrink-0">{rowMenu(row)}</span>
      </div>
    ),
    [dateTime, hasName, inactiveHint, marketName, rowMenu, typeBadge],
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
    </div>
  );
};

export default memo(NotificationsPage);
