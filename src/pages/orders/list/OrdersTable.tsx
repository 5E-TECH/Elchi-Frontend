// dizayn-v2: superadmin-orders-list, admin-orders-list, registrator-orders-list, market-orders-list, manager-orders-list-all, manager-orders-list-pending, manager-orders-list-cancelled
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { Copy, Inbox, RotateCcw } from "lucide-react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { OrderStatusBadge, ReturnRequestedTag } from "../../../entities/order";
import type { OrderListItem } from "../../../entities/order/types/order";
import { ExtraCostApprovalTag } from "../../../entities/orders/ui/ExtraCostApprovalTag";
import type { RootState } from "../../../app/config/store";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import {
    Badge,
    Button,
    DataTable,
    EmptyState,
    IconButton,
    QueryBoundary,
    SkeletonTable,
    type DataTableColumn,
    type DataTableSort,
} from "../../../shared/ui/primitives";

const EMPTY_SELECTED_IDS = new Set<string>();

/** Server sukuti (OpenAPI `GET /orders`: «default created_at desc») — URL'da saralash yo'q bo'lsa shu ko'rinadi. */
const DEFAULT_SORT: DataTableSort = { key: "createdAt", direction: "desc" };

/** Menejer amallari: sotish / bekor qilish shu holatlarda, qaytarish — sotilgan va bekor qilinganda. */
const ROLLBACK_STATUSES = new Set(["sold", "cancelled"]);

interface Props {
    data: OrderListItem[];
    isLoading: boolean;
    /** Ro'yxat so'rovi yiqildi — qator yo'q bo'lsa «Buyurtmalar topilmadi» o'rniga xato + «Qayta urinish». */
    isError?: boolean;
    error?: unknown;
    onRetry?: () => void;
    /**
     * Qatorni sichqoncha bilan bosish (qulaylik). Klaviatura va ekran o'quvchi — `№` havolasi orqali
     * (`getOrderHref`); qator `role="button"` emas (ichida havola va tugmalar bor).
     */
    onRowClick?: (order: OrderListItem, index: number) => void;
    /** Tafsilot havolasi (sukut — nisbiy `edit/{id}`: `/orders/edit/{id}`). */
    getOrderHref?: (order: OrderListItem) => string;
    canUseOrderActions?: (order: OrderListItem) => boolean;
    /**
     * Qatordagi «Sotish» faolmi. fix3b LC-04: menejer kuryer qo'lidagi buyurtmani sota olmaydi (backend 400) —
     * tugma o'chiq turadi va sababi yoziladi (maket `manager-orders-list-pending`).
     */
    canSellOrder?: (order: OrderListItem) => boolean;
    onSellOrder?: (order: OrderListItem) => void;
    onCancelOrder?: (order: OrderListItem) => void;
    onRollbackOrder?: (order: OrderListItem) => void;
    /** Biror amal so'rovi ketmoqda — hamma amal tugmalari o'chiq. */
    isOrderActionPending?: boolean;
    isSelectable?: (order: OrderListItem) => boolean;
    selectedIds?: Set<string>;
    onSelectChange?: (id: string, checked: boolean) => void;
    onSelectAll?: (checked: boolean) => void;
    sortConfig?: DataTableSort | null;
    onSortChange?: (config: DataTableSort | null) => void;
    /** Qidiruv to'liq buyurtma raqamiga aynan mos kelgan buyurtma — ro'yxat boshida, «Aniq» belgisi bilan. */
    pinnedOrderId?: string;
    /** Jadval / kartalar ro'yxati nomi. */
    label?: string;
    /** Bo'sh holatda «Filtrlarni tozalash» (filtr faol bo'lsa). */
    onClearFilters?: () => void;
    /** Fonda yangilanmoqda — ro'yxat xiralashadi. */
    busy?: boolean;
}

/**
 * Kuryer qatori `status=cancelled` + `transport_status="cancelled (sent)"` bilan keladi (backend
 * `normalizeOrderStatusForDisplay`) — ko'rsatishda «Bekor — jo'natilgan».
 */
const getDisplayStatus = (order: OrderListItem) =>
    (order as { transport_status?: unknown }).transport_status === "cancelled (sent)" ? "cancelled (sent)" : order.status;

const OrdersTable = ({
    data,
    isLoading,
    isError = false,
    error,
    onRetry,
    onRowClick,
    getOrderHref = (order) => `edit/${order.id}`,
    canUseOrderActions,
    canSellOrder,
    onSellOrder,
    onCancelOrder,
    onRollbackOrder,
    isOrderActionPending = false,
    isSelectable,
    selectedIds = EMPTY_SELECTED_IDS,
    onSelectChange,
    onSelectAll,
    sortConfig,
    onSortChange,
    pinnedOrderId,
    label,
    onClearFilters,
    busy = false,
}: Props) => {
    const { t, i18n } = useTranslation("orders");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const role = useSelector((state: RootState) => state.role.role);
    const isMarket = role === "market";
    const hasActions = Boolean(onSellOrder || onCancelOrder || onRollbackOrder);
    const hasSelection = Boolean(isSelectable && onSelectChange && onSelectAll);
    // Menejer jadvalida (amallar ustuni) planshetda summa ostida market yo'q (maket `manager-orders-list-*`).
    const showTabletMarket = !isMarket && !hasActions;

    const handleCopyOrderId = useCallback(
        (id: string) => {
            void copyToClipboard(id).then((copied) => {
                if (copied) {
                    notify.success(t("orderNumberCopied"));
                } else {
                    notify.error(t("orderNumberCopyFailed", { id }));
                }
            });
        },
        [t],
    );

    const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
    const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);

    const isPinned = useCallback(
        (order: OrderListItem, index: number) => Boolean(pinnedOrderId) && index === 0 && String(order.id) === pinnedOrderId,
        [pinnedOrderId],
    );

    const exactBadge = useMemo(
        () => (
            <Badge tone="info" title={t("exactNumberMatchTitle")} data-testid="exact-match-badge">
                {t("exactNumberMatch")}
            </Badge>
        ),
        [t],
    );

    const deliveryBadge = useCallback(
        (order: OrderListItem) =>
            order.where_deliver ? (
                <Badge>{order.where_deliver === "center" ? t("deliveryToCenter") : t("deliveryToHome")}</Badge>
            ) : null,
        [t],
    );

    const statusBadges = useCallback(
        (order: OrderListItem) => (
            <>
                <OrderStatusBadge status={getDisplayStatus(order)} />
                <ReturnRequestedTag order={order} />
                <ExtraCostApprovalTag orderId={order.id} status={order.status} />
            </>
        ),
        [],
    );

    /** Menejer amallari — jadvalda `sm`, telefon kartasida to'liq enli (44 px). */
    const renderActions = useCallback(
        (order: OrderListItem, place: "table" | "card"): ReactNode => {
            if (!hasActions) return null;
            const id = order.id;
            const size = place === "table" ? "sm" : "md";
            const grow = place === "card" ? "flex-1" : undefined;
            if (!canUseOrderActions?.(order)) {
                return place === "table" ? (
                    <span className="text-text-subtle" aria-label={t("ordersList.noAction")}>
                        —
                    </span>
                ) : null;
            }

            if (ROLLBACK_STATUSES.has(order.status)) {
                return onRollbackOrder ? (
                    <Button
                        variant="secondary"
                        size={size}
                        compact
                        leftIcon={RotateCcw}
                        className={grow}
                        title={t("ordersList.rollbackHint")}
                        aria-label={t("ordersList.rollbackOrder", { id })}
                        aria-haspopup="dialog"
                        disabled={isOrderActionPending}
                        onClick={() => onRollbackOrder(order)}
                    >
                        {t("ordersList.rollback")}
                    </Button>
                ) : null;
            }

            const sellable = canSellOrder ? canSellOrder(order) : true;
            return (
                <>
                    {onSellOrder ? (
                        <Button
                            variant="secondary"
                            size={size}
                            compact
                            className={grow}
                            disabled={isOrderActionPending || !sellable}
                            title={sellable ? undefined : t("ordersList.courierHeldTitle")}
                            aria-label={
                                sellable ? t("ordersList.sellOrder", { id }) : t("ordersList.courierHeldLabel", { id })
                            }
                            aria-haspopup={sellable ? "dialog" : undefined}
                            onClick={() => onSellOrder(order)}
                        >
                            {t("ordersList.sell")}
                        </Button>
                    ) : null}
                    {onCancelOrder ? (
                        <Button
                            variant="danger-soft"
                            size={size}
                            compact
                            className={grow}
                            disabled={isOrderActionPending}
                            aria-label={t("ordersList.cancelOrder", { id })}
                            aria-haspopup="dialog"
                            onClick={() => onCancelOrder(order)}
                        >
                            {place === "table" ? (
                                // Planshetda qisqa «Bekor» (maket `manager-orders-list-*`): jadval 736 px ga sig'sin.
                                <>
                                    <span className="max-lg:hidden">{t("ordersList.cancel")}</span>
                                    <span className="hidden max-lg:inline">{t("ordersList.cancelShort")}</span>
                                </>
                            ) : (
                                t("ordersList.cancel")
                            )}
                        </Button>
                    ) : null}
                </>
            );
        },
        [
            canSellOrder,
            canUseOrderActions,
            hasActions,
            isOrderActionPending,
            onCancelOrder,
            onRollbackOrder,
            onSellOrder,
            t,
        ],
    );

    const columns = useMemo<DataTableColumn<OrderListItem>[]>(() => {
        const list: DataTableColumn<OrderListItem>[] = [
            {
                id: "createdAt",
                header: t("ordersList.columns.order"),
                sortable: true,
                firstDirection: "desc",
                sortTitle: t("ordersList.sortByDate"),
                cell: (order, index) => (
                    <>
                        <div className="flex items-center gap-0.5">
                            <Link
                                to={getOrderHref(order)}
                                className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
                            >
                                №{order.id}
                            </Link>
                            <IconButton
                                size="sm"
                                icon={Copy}
                                label={t("ordersList.copyNumber", { id: order.id })}
                                // Market jadvali planshetda 736 px ga sig'sin: maket `market-orders-list` da nusxalash yo'q.
                                className={cx("-my-1", isMarket && "max-lg:hidden")}
                                onClick={() => handleCopyOrderId(String(order.id))}
                            />
                            {isPinned(order, index) ? exactBadge : null}
                        </div>
                        <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(order.createdAt)}</div>
                    </>
                ),
            },
            {
                id: "customer",
                header: t("ordersList.columns.customer"),
                cell: (order) => (
                    <>
                        <div className="whitespace-nowrap font-semibold text-text">{order.customer?.name ?? "—"}</div>
                        <div className="whitespace-nowrap text-[13px] text-text-muted">
                            {formatPhone(order.customer?.phone_number) || "—"}
                        </div>
                        {isMarket ? (
                            <div className="hidden whitespace-nowrap text-[13px] text-text-muted max-lg:block">
                                {order.district?.name ?? "—"}
                            </div>
                        ) : null}
                    </>
                ),
            },
            {
                id: "area",
                header: t("ordersList.columns.area"),
                hideBelow: "lg",
                cell: (order) => (
                    <>
                        <div className="whitespace-nowrap">{order.district?.name ?? "—"}</div>
                        {order.district?.region?.name ? (
                            <div className="whitespace-nowrap text-[13px] text-text-muted">{order.district.region.name}</div>
                        ) : null}
                    </>
                ),
            },
        ];

        if (!isMarket) {
            list.push({
                id: "market",
                header: t("ordersList.columns.market"),
                hideBelow: "lg",
                className: "whitespace-nowrap",
                cell: (order) => order.market?.name ?? "—",
            });
        }

        list.push(
            {
                id: "status",
                header: t("ordersList.columns.status"),
                sortable: true,
                cell: (order) => <div className="flex flex-wrap items-center gap-1">{statusBadges(order)}</div>,
            },
            {
                id: "delivery",
                header: t("ordersList.columns.delivery"),
                // Market jadvalida planshetda ham ko'rinadi (maket `market-orders-list`).
                hideBelow: isMarket ? undefined : "lg",
                cell: deliveryBadge,
            },
            {
                id: "total_price",
                header: showTabletMarket ? (
                    <>
                        {t("ordersList.columns.amount")}
                        {/* Saralash tugmasi `gap-1` — «Summa / market» orasidagi bo'shliq shundan (maket `.el-th-sort`). */}
                        <span className="hidden max-lg:inline">{t("ordersList.columns.amountMarket")}</span>
                    </>
                ) : (
                    t("ordersList.columns.amount")
                ),
                sortable: true,
                align: "end",
                cell: (order) => (
                    <>
                        <div className="font-semibold text-text">{money(order.total_price)}</div>
                        {showTabletMarket ? (
                            <div className="hidden text-[13px] font-normal text-text-muted max-lg:block">
                                {order.market?.name ?? "—"}
                            </div>
                        ) : null}
                    </>
                ),
            },
        );

        if (hasActions) {
            list.push({
                id: "actions",
                header: t("ordersList.columns.actions"),
                className: "whitespace-nowrap",
                cell: (order) => <div className="flex items-center gap-2">{renderActions(order, "table")}</div>,
            });
        }

        return list;
    }, [
        dateTime,
        deliveryBadge,
        exactBadge,
        getOrderHref,
        handleCopyOrderId,
        hasActions,
        isMarket,
        isPinned,
        money,
        renderActions,
        showTabletMarket,
        statusBadges,
        t,
    ]);

    const renderCard = useCallback(
        (order: OrderListItem, index: number) => {
            const selectable = hasSelection;
            const meta = isMarket
                ? [`№${order.id}`, order.district?.name ?? "—"]
                : [`№${order.id}`, order.district?.name ?? "—", order.market?.name ?? "—"];
            const actions = renderActions(order, "card");
            const showCourierHeldNote =
                hasActions &&
                Boolean(onSellOrder) &&
                Boolean(canUseOrderActions?.(order)) &&
                !ROLLBACK_STATUSES.has(order.status) &&
                canSellOrder !== undefined &&
                !canSellOrder(order);

            return (
                <>
                    <Link
                        to={getOrderHref(order)}
                        className={cx("flex min-w-0 flex-col gap-1 px-4 py-3 text-text", selectable && "pl-12")}
                    >
                        <span className="flex min-w-0 justify-between gap-2">
                            <span className="min-w-0 font-semibold">{order.customer?.name ?? "—"}</span>
                            <span className="whitespace-nowrap font-semibold">{money(order.total_price)}</span>
                        </span>
                        <span className="text-[13px] text-text-muted">
                            {meta.join(" · ")}
                            {isMarket ? (
                                <>
                                    {" · "}
                                    <span className="whitespace-nowrap">{dateTime(order.createdAt)}</span>
                                </>
                            ) : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                            {isPinned(order, index) ? exactBadge : null}
                            {statusBadges(order)}
                            {deliveryBadge(order)}
                            {isMarket ? null : (
                                <span className="ml-auto whitespace-nowrap text-xs text-text-muted">{dateTime(order.createdAt)}</span>
                            )}
                        </span>
                    </Link>
                    {showCourierHeldNote ? (
                        <p className={cx("px-4 pb-2 text-xs text-text-muted", selectable && "pl-12")}>
                            {t("ordersList.courierHeldNote")}
                        </p>
                    ) : null}
                    {actions ? <div className={cx("flex gap-2 px-4 pb-3", selectable && "pl-12")}>{actions}</div> : null}
                </>
            );
        },
        [
            canSellOrder,
            canUseOrderActions,
            dateTime,
            deliveryBadge,
            exactBadge,
            getOrderHref,
            hasActions,
            hasSelection,
            isMarket,
            isPinned,
            money,
            onSellOrder,
            renderActions,
            statusBadges,
            t,
        ],
    );

    const selection = useMemo(
        () =>
            hasSelection && isSelectable && onSelectChange && onSelectAll
                ? {
                      isSelected: (order: OrderListItem) => selectedIds.has(order.id),
                      isSelectable,
                      onToggle: (order: OrderListItem, checked: boolean) => onSelectChange(order.id, checked),
                      onToggleAll: onSelectAll,
                      headerLabel: t("ordersList.selectPage"),
                      rowLabel: (order: OrderListItem) => t("ordersList.selectOrder", { id: order.id }),
                      disabledRowLabel: (order: OrderListItem) => t("ordersList.alreadySent", { id: order.id }),
                  }
                : undefined,
        [hasSelection, isSelectable, onSelectAll, onSelectChange, selectedIds, t],
    );

    const skeletonColumns = useMemo(
        () => columns.map((column) => (typeof column.header === "string" ? column.header : t("ordersList.columns.amount"))),
        [columns, t],
    );

    // Yuklanayotganda va xatoda (qator yo'q) `data` berilmaydi — QueryBoundary skelet / xatoni chizadi.
    const query = {
        data: isLoading || (isError && data.length === 0) ? undefined : data,
        isLoading,
        isError,
        error,
        refetch: onRetry,
    };

    return (
        <QueryBoundary
            query={query}
            keepPreviousData={false}
            loading={<SkeletonTable framed={false} columns={skeletonColumns} />}
            empty={
                <EmptyState
                    icon={Inbox}
                    title={t("ordersNotFound")}
                    description={
                        <>
                            {t("ordersEmptyCreateHintLine1")}
                            <br />
                            {t("ordersEmptyCreateHintLine2")}
                        </>
                    }
                    action={
                        onClearFilters ? (
                            <Button variant="secondary" onClick={onClearFilters}>
                                {t("ordersList.clearFilters")}
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
                    getRowKey={(order) => String(order.id)}
                    label={label}
                    sort={onSortChange ? (sortConfig ?? DEFAULT_SORT) : undefined}
                    onSortChange={onSortChange}
                    density={hasActions || hasSelection ? "tight" : isMarket ? "tablet-tight" : "default"}
                    selection={selection}
                    onRowClick={onRowClick}
                    renderCard={renderCard}
                    busy={busy}
                    className="border-t border-border"
                />
            )}
        </QueryBoundary>
    );
};

export default memo(OrdersTable);
