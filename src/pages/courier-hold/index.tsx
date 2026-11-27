// dizayn-v2: (maket yo'q) superadmin-returns-list
import { memo, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { ArrowLeft, Clock, ListFilter, Truck, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { formatOrderRef, OrderStatusBadge } from "../../entities/order";
import { useOrders } from "../../entities/order/api/orderApi";
import type { OrderListItem } from "../../entities/order/types/order";
import {
  COURIER_HOLD_NEAR_FROM_HOURS,
  COURIER_HOLD_DEADLINE_HOURS,
  courierHoldHours,
  courierHoldLevel,
  useCourierHoldSummary,
  type CourierHoldSummaryRow,
} from "../../entities/orders/courierHold";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import { formatPhone } from "../../shared/lib/formatPhone";
import { scrollShellContentToTop, usePagination } from "../../shared/lib/usePagination";
import {
  Button,
  buttonClasses,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  StatusBadge,
  Tabs,
  type DataTableColumn,
  type TabItem,
} from "../../shared/ui/primitives";
import {
  COURIER_HOLD_DEFAULT_LIMIT,
  COURIER_HOLD_LEVEL_TONE,
  COURIER_HOLD_PAGE_SIZES,
  COURIER_HOLD_TABS,
  buildCourierHoldListParams,
  courierHoldOrderHref,
  ordersListHref,
  readCourierHoldCourier,
  readCourierHoldTab,
  showsOrderList,
  writeCourierHoldCourier,
  writeCourierHoldTab,
  type CourierHoldTab,
} from "./model/courierHoldView";

const LINK = "whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline";

type Viewer = "admin" | "manager" | "courier" | "market";

const toViewer = (role: string | null): Viewer =>
  role === "manager" ? "manager" : role === "courier" ? "courier" : role === "market" ? "market" : "admin";

/**
 * KURYERDAGI BUYURTMALAR — `/courier-hold` (onXzDc5n), dizayn v2.
 *
 * Kuryer qo'lida turgan (yo'lda, kutilmoqda, mijoz kutilmoqda) buyurtmalar — kuryerga topshirilgan paytdan
 * (`last_handover_at`) qancha soat o'tgani bo'yicha. Uchta ro'yxat: «72 soatdan oshgan», «48 soatga yaqin» (36–48 soat:
 * shu oynada kuryer va marketga bir marta ogohlantirish ketadi) va «Kuryerlar bo'yicha» (har kuryerda nechta,
 * qaysi oraliqda, eng eskisi necha soat). Kuryer qatori bosilsa — o'sha kuryerdagi hamma ochiq buyurtmalar.
 *
 * Doira backend'da, faqat tokendan: superadmin / admin — hammasi, menejer — o'z filiali, kuryer — o'zi, market — o'z
 * marketi (kuryer telefoni yashirin). Ro'yxat — `GET /orders?courier_hold=…` (eng eskisi birinchi), tab sonlari va
 * jamlama — `GET orders/courier-hold/summary`. Ikkalasi `["orders", …]` kaliti ostida: sotish / bekor qilish / jonli
 * kanaldagi buyurtma xabari ularni yangilaydi.
 */
const CourierHoldPage = () => {
  const { t, i18n } = useTranslation(["courierHold", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const viewer = toViewer(role);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readCourierHoldTab(searchParams);
  const courierId = readCourierHoldCourier(searchParams);
  const listVisible = showsOrderList(tab, courierId);
  const { page, limit, setPage, setLimit } = usePagination({
    key: "courierHold",
    defaultLimit: COURIER_HOLD_DEFAULT_LIMIT,
    allowedLimits: COURIER_HOLD_PAGE_SIZES,
  });

  // Jamlama — doim (tab sonlari va kuryer nomlari shundan).
  const summaryQuery = useCourierHoldSummary({});
  const summary = summaryQuery.data ?? null;

  const { useGetOrders } = useOrders();
  const listParams = useMemo(() => buildCourierHoldListParams(tab, courierId, { page, limit }), [courierId, limit, page, tab]);
  const listQuery = useGetOrders(listParams, listVisible, undefined, { silentErrorWhenCached: true, refetchOnWindowFocus: true });
  const listTotal = Number(listQuery.data?.total ?? 0) || 0;
  const rows = useMemo<OrderListItem[]>(
    () => (Array.isArray(listQuery.data?.data) ? listQuery.data.data : []),
    [listQuery.data],
  );

  // Sahifa ro'yxat oxiridan tashqarida qolsa (buyurtma sotildi / eski `?page=N`) — oxirgi sahifaga.
  const lastPage = Math.max(1, Math.ceil(listTotal / limit));
  const pastEnd = Boolean(listQuery.data && !listQuery.isPlaceholderData && !listQuery.isError && rows.length === 0 && listTotal > 0);
  useEffect(() => {
    if (pastEnd && page > lastPage) setPage(lastPage);
  }, [lastPage, page, pastEnd, setPage]);

  const changeTab = useCallback(
    (next: CourierHoldTab) => setSearchParams((prev) => writeCourierHoldTab(prev, next), { replace: true }),
    [setSearchParams],
  );
  const selectCourier = useCallback(
    (id: string) => {
      setSearchParams((prev) => writeCourierHoldCourier(prev, id));
      scrollShellContentToTop();
    },
    [setSearchParams],
  );
  const changePage = useCallback(
    (next: number) => {
      setPage(next);
      scrollShellContentToTop();
    },
    [setPage],
  );

  // ─── Ko'rinish ─────────────────────────────────────────────────────────────
  const money = useCallback((value: unknown) => formatMoneyLocalized(Number(value) || 0, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);
  const hoursText = (hours: number) => t("hours", { value: count(hours) });

  const courierRow = useMemo(
    () => summary?.couriers.find((row) => row.courierId === courierId) ?? null,
    [courierId, summary],
  );
  const courierName = (row: Pick<CourierHoldSummaryRow, "courierId" | "name"> | null, id: string) =>
    row?.name ?? t("unknownCourier", { id });
  const selectedCourierName = courierId ? courierName(courierRow, courierId) : "";

  const tabs: TabItem<CourierHoldTab>[] = COURIER_HOLD_TABS.map((value) => ({
    value,
    label: t(`tabs.${value}`),
    ...(summary
      ? {
          count:
            value === "over_72" ? summary.totals.over72 : value === "near_48" ? summary.totals.near48 : summary.totals.couriers,
        }
      : {}),
  }));

  // Kuryerda necha soat — belgi (36 dan kam — neytral, 36–48 — ogohlantirish, 48+ — xavf) va qachondan beri.
  const holdBadge = (order: OrderListItem) => {
    const hours = courierHoldHours(order.last_handover_at);
    if (hours === null) return <span className="text-text-muted">—</span>;
    const level = courierHoldLevel(hours);
    return (
      <StatusBadge
        tone={COURIER_HOLD_LEVEL_TONE[level]}
        icon={Clock}
        label={hoursText(hours)}
        data-level={level}
        data-testid={`courier-hold-hours-${order.id}`}
      />
    );
  };
  const sinceText = (order: OrderListItem) =>
    order.last_handover_at ? t("since", { date: dateTime(order.last_handover_at) }) : null;

  const refOf = (order: OrderListItem) => formatOrderRef(order);
  const orderLink = (order: OrderListItem, className = LINK) => (
    <Link to={courierHoldOrderHref(order.id)} aria-label={t("openOrder", { ref: refOf(order) })} className={className}>
      {refOf(order)}
    </Link>
  );
  const addressOf = (order: OrderListItem) =>
    [order.district?.region?.name, order.district?.name].filter(Boolean).join(" · ") || "—";
  const customerOf = (order: OrderListItem) => ({
    name: order.customer?.name?.trim() || "—",
    phone: order.customer?.phone_number ? formatPhone(order.customer.phone_number) : null,
  });
  const orderCourierName = (order: OrderListItem) => {
    const id = order.holder_courier_id ?? order.courier?.id ?? order.courier_id ?? "";
    const fromSummary = id ? summary?.couriers.find((row) => row.courierId === String(id)) : undefined;
    return order.courier?.name?.trim() || fromSummary?.name || (id ? t("unknownCourier", { id }) : "—");
  };

  const showMarket = viewer !== "market";
  const showCourier = viewer !== "courier" && !courierId;

  const orderColumns: DataTableColumn<OrderListItem>[] = [
    {
      id: "order",
      header: t("columns.order"),
      cell: (order) => orderLink(order),
    },
    {
      id: "held",
      header: t("columns.held"),
      cell: (order) => (
        <span className="flex flex-col items-start gap-1">
          {holdBadge(order)}
          {sinceText(order) ? <span className="text-[13px] text-text-muted">{sinceText(order)}</span> : null}
        </span>
      ),
    },
    ...(showCourier
      ? [{ id: "courier", header: t("columns.courier"), cell: (order: OrderListItem) => orderCourierName(order) }]
      : []),
    ...(showMarket
      ? [{ id: "market", header: t("columns.market"), cell: (order: OrderListItem) => order.market?.name ?? "—" }]
      : []),
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (order) => {
        const customer = customerOf(order);
        return (
          <span className="flex flex-col">
            <span>{customer.name}</span>
            {customer.phone ? <span className="whitespace-nowrap text-[13px] tabular-nums text-text-muted">{customer.phone}</span> : null}
          </span>
        );
      },
    },
    { id: "address", header: t("columns.address"), cell: (order) => addressOf(order) },
    { id: "status", header: t("columns.status"), cell: (order) => <OrderStatusBadge status={order.status} order={order} /> },
    {
      id: "amount",
      header: t("columns.amount"),
      align: "end",
      cell: (order) => <span className="whitespace-nowrap tabular-nums">{money(order.total_price)}</span>,
    },
  ];

  const renderOrderCard = (order: OrderListItem) => {
    const customer = customerOf(order);
    return (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3 text-sm text-text">
        <span className="flex items-start justify-between gap-2">
          {orderLink(order, "-my-3 inline-flex min-h-11 items-center font-semibold text-action-fg hover:underline")}
          {holdBadge(order)}
        </span>
        {sinceText(order) ? <span className="text-[13px] text-text-muted">{sinceText(order)}</span> : null}
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} order={order} />
          <span className="whitespace-nowrap font-semibold tabular-nums">{money(order.total_price)}</span>
        </span>
        <span className="text-[13px] text-text-muted">
          {[showMarket ? order.market?.name : null, customer.name].filter(Boolean).join(" · ")}
          {customer.phone ? (
            <>
              {" · "}
              <span className="whitespace-nowrap tabular-nums">{customer.phone}</span>
            </>
          ) : null}
        </span>
        <span className="text-[13px] text-text-muted">{addressOf(order)}</span>
        {showCourier ? (
          <span className="flex items-center gap-1.5 text-[13px] text-text">
            <Truck size={14} className="flex-none text-text-muted" aria-hidden="true" />
            {orderCourierName(order)}
          </span>
        ) : null}
      </div>
    );
  };

  // ─── Kuryerlar bo'yicha ────────────────────────────────────────────────────
  const bucket = (value: number, tone: "warning" | "danger" | null) =>
    value > 0 && tone ? (
      <span className={tone === "danger" ? "font-semibold tabular-nums text-danger-fg" : "font-semibold tabular-nums text-warning-fg"}>
        {count(value)}
      </span>
    ) : (
      <span className={value > 0 ? "tabular-nums" : "tabular-nums text-text-muted"}>{count(value)}</span>
    );
  const oldestBadge = (row: CourierHoldSummaryRow) => {
    if (row.oldestHours === null) return <span className="text-text-muted">—</span>;
    const level = courierHoldLevel(row.oldestHours);
    return <StatusBadge tone={COURIER_HOLD_LEVEL_TONE[level]} icon={Clock} label={hoursText(row.oldestHours)} data-level={level} />;
  };
  const openCourierButton = (row: CourierHoldSummaryRow, fullWidth = false) => (
    <Button
      variant="secondary"
      compact
      className={fullWidth ? "w-full" : undefined}
      onClick={() => selectCourier(row.courierId)}
      aria-label={t("openCourierLabel", { name: courierName(row, row.courierId) })}
      data-testid={`courier-hold-open-${row.courierId}`}
    >
      {t("openCourier")}
    </Button>
  );
  const courierCell = (row: CourierHoldSummaryRow) => (
    <span className="flex flex-col">
      <span className="font-semibold">{courierName(row, row.courierId)}</span>
      {row.phone ? <span className="whitespace-nowrap text-[13px] tabular-nums text-text-muted">{formatPhone(row.phone)}</span> : null}
    </span>
  );

  const courierColumns: DataTableColumn<CourierHoldSummaryRow>[] = [
    { id: "courier", header: t("columns.courier"), cell: courierCell },
    { id: "total", header: t("columns.total"), align: "end", cell: (row) => <span className="font-semibold tabular-nums">{count(row.total)}</span> },
    { id: "under36", header: t("columns.under36"), align: "end", cell: (row) => bucket(row.under36, null) },
    { id: "near48", header: t("columns.near48"), align: "end", cell: (row) => bucket(row.near48, "warning") },
    { id: "over48", header: t("columns.over48"), align: "end", cell: (row) => bucket(row.over48, "danger") },
    { id: "over72", header: t("columns.over72"), align: "end", cell: (row) => bucket(row.over72, "danger") },
    { id: "oldest", header: t("columns.oldest"), cell: oldestBadge },
    {
      id: "cancelledHeld",
      header: t("columns.cancelledHeld"),
      align: "end",
      cell: (row) => (
        <span title={t("cancelledHeldHint")} className={row.cancelledHeld > 0 ? "tabular-nums" : "tabular-nums text-text-muted"}>
          {count(row.cancelledHeld)}
        </span>
      ),
    },
    { id: "actions", header: t("columns.actions"), align: "end", cell: (row) => openCourierButton(row) },
  ];

  const renderCourierCard = (row: CourierHoldSummaryRow) => (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3 text-sm text-text">
      <span className="flex items-start justify-between gap-2">
        {courierCell(row)}
        {oldestBadge(row)}
      </span>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["under36", row.under36, null],
            ["near48", row.near48, "warning"],
            ["over48", row.over48, "danger"],
            ["over72", row.over72, "danger"],
          ] as const
        ).map(([key, value, tone]) => (
          <div key={key} className="flex flex-col gap-0.5 rounded-lg bg-sunken px-1 py-1.5">
            <dt className="text-xs leading-tight text-text-muted">{t(`columns.${key}`)}</dt>
            <dd className="m-0 text-sm">{bucket(value, tone)}</dd>
          </div>
        ))}
      </dl>
      <span className="text-[13px] text-text-muted">
        {t("courierTotal", { value: count(row.total) })}
        {row.cancelledHeld > 0 ? ` · ${t("courierCancelledHeld", { value: count(row.cancelledHeld) })}` : ""}
      </span>
      {openCourierButton(row, true)}
    </div>
  );

  // ─── Sarlavha ──────────────────────────────────────────────────────────────
  const description: ReactNode = t(`description.${viewer}`);
  const headerActions =
    viewer !== "courier" ? (
      <Link to={ordersListHref(tab, courierId)} className={buttonClasses({ variant: "secondary", compact: true })}>
        <ListFilter aria-hidden="true" size={16} strokeWidth={2} />
        {t("openInOrders")}
      </Link>
    ) : undefined;

  const emptyKey = tab === "couriers" ? (courierId ? "courier" : "couriers") : tab;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={description} actions={headerActions} />

      <Card
        as="section"
        padding="none"
        aria-label={t("listLabel")}
        footer={
          listVisible && listTotal > 0 ? (
            <Pagination
              page={Number(listQuery.data?.page) || page}
              pageSize={Number(listQuery.data?.limit) || limit}
              total={listTotal}
              onPageChange={changePage}
              onPageSizeChange={setLimit}
              pageSizeOptions={COURIER_HOLD_PAGE_SIZES}
              summary={(range) => t("pagination", range)}
            />
          ) : undefined
        }
      >
        <Tabs
          items={tabs}
          value={tab}
          onValueChange={changeTab}
          ariaLabel={t("tabsLabel")}
          listClassName="px-3"
          countBusy={Boolean(summaryQuery.isPlaceholderData && summaryQuery.isFetching)}
        />

        <p className="m-0 px-5 pt-3 text-[13px] text-text-muted max-md:px-4">
          {t("hint", { near: COURIER_HOLD_NEAR_FROM_HOURS, deadline: COURIER_HOLD_DEADLINE_HOURS })}
        </p>

        {courierId ? (
          <div className="flex flex-wrap items-center gap-2 px-5 pt-3 max-md:px-4" data-testid="courier-hold-courier">
            {tab === "couriers" ? (
              <Button variant="ghost" compact leftIcon={ArrowLeft} onClick={() => selectCourier("")}>
                {t("backToCouriers")}
              </Button>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-sunken py-1 pr-1 pl-3 text-[13px] text-text">
              <UserRound size={14} className="flex-none text-text-muted" aria-hidden="true" />
              <span className="min-w-0 truncate">{t("courierFilter", { name: selectedCourierName })}</span>
              {tab !== "couriers" ? (
                <IconButton icon={X} label={t("clearCourier")} variant="ghost" size="sm" onClick={() => selectCourier("")} />
              ) : null}
            </span>
          </div>
        ) : null}

        {listVisible ? (
          <QueryBoundary
            query={{
              data: listQuery.data ? rows : undefined,
              isLoading: listQuery.isLoading,
              isPending: listQuery.isPending,
              isFetching: listQuery.isFetching,
              isPaused: listQuery.isPaused,
              isError: listQuery.isError,
              error: listQuery.error,
              refetch: listQuery.refetch,
            }}
            isEmpty={(items) => items.length === 0}
            loadingLabel={t("loading")}
            loading={
              <SkeletonTable
                framed={false}
                columns={[t("columns.order"), t("columns.held"), t("columns.customer"), t("columns.status")]}
                rows={6}
              />
            }
            empty={<EmptyState icon={Clock} title={t(`empty.${emptyKey}`)} description={t(`empty.${emptyKey}Description`)} />}
            error={(queryError, retry) => <ErrorState error={queryError} title={t("loadFailed")} onRetry={retry} />}
          >
            {(items, { isRefetching }) => (
              <DataTable
                rows={items}
                columns={orderColumns}
                getRowKey={(order) => order.id}
                label={t("listLabel")}
                cardsLabel={t("cardsLabel")}
                density="tablet-tight"
                renderCard={renderOrderCard}
                busy={isRefetching}
              />
            )}
          </QueryBoundary>
        ) : (
          <QueryBoundary
            query={{
              data: summary?.couriers,
              isLoading: summaryQuery.isLoading,
              isPending: summaryQuery.isPending,
              isFetching: summaryQuery.isFetching,
              isPaused: summaryQuery.isPaused,
              isError: summaryQuery.isError,
              error: summaryQuery.error,
              refetch: summaryQuery.refetch,
            }}
            isEmpty={(items) => items.length === 0}
            loadingLabel={t("loading")}
            loading={
              <SkeletonTable
                framed={false}
                columns={[t("columns.courier"), t("columns.total"), t("columns.over72"), t("columns.oldest")]}
                rows={6}
              />
            }
            empty={<EmptyState icon={Clock} title={t("empty.couriers")} description={t("empty.couriersDescription")} />}
            error={(queryError, retry) => <ErrorState error={queryError} title={t("loadFailed")} onRetry={retry} />}
          >
            {(items, { isRefetching }) => (
              <DataTable
                rows={items}
                columns={courierColumns}
                getRowKey={(row) => row.courierId}
                label={t("couriersLabel")}
                cardsLabel={t("couriersLabel")}
                density="tablet-tight"
                renderCard={renderCourierCard}
                busy={isRefetching}
              />
            )}
          </QueryBoundary>
        )}
      </Card>
    </div>
  );
};

export default memo(CourierHoldPage);
