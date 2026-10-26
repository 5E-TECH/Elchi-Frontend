// dizayn-v2: superadmin-orders-list, admin-orders-list, registrator-orders-list, market-orders-list, manager-orders-list-all, manager-orders-list-pending, manager-orders-list-cancelled
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { Copy, Inbox, RotateCcw } from "lucide-react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
    formatOrderRef,
    FulfillmentSourceTag,
    orderNumberOf,
    OrderReturnPlace,
    OrderStatusBadge,
    ReturnRequestedTag,
} from "../../../entities/order";
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
import { isMarketSideRole } from "../../../entities/user/lib/role";

const EMPTY_SELECTED_IDS = new Set<string>();

/**
 * Uzun matn (mijoz, tuman, viloyat, market) — bir qatorda, sig'masa `…` (to'liq matn `title` da). Real
 * ma'lumotda 280 px li ism 1440 px dan tor desktopda (yon menyu ochiq) jadvalni gorizontal aylantirib, «Summa»
 * ni ekrandan chiqarib yuborardi (D-02).
 *
 * `grid` + `minmax(0,1fr)`: matn ustunning eng kichik kengligiga (min-content) qo'shilmaydi, lekin joy bo'lsa
 * to'liq ko'rinadi (max-content) — jadval avval bo'sh joyni beradi, yetmasa faqat kerakli qadar kesadi.
 * `max-w` — bitta juda uzun qiymat ustunni haddan tashqari kengaytirmasin.
 */
const FitText = ({
    text,
    wide = false,
    tabletOnly = false,
    className,
}: {
    text?: string | null;
    wide?: boolean;
    /** Faqat < 1024 da (market jadvalida mijoz ostidagi tuman). */
    tabletOnly?: boolean;
    className?: string;
}) => (
    <div
        className={cx(
            tabletOnly ? "hidden max-lg:grid" : "grid",
            "grid-cols-[minmax(0,1fr)]",
            wide ? "max-w-[260px]" : "max-w-[220px]",
            className,
        )}
    >
        <span className="truncate" title={text ?? undefined}>
            {text || "—"}
        </span>
    </div>
);
/**
 * 1024–1439 da katak chekkasi `tight` zichlikdagidek (ichki 8, birinchi/oxirgi 16 px) — 7 ustun shunda sig'adi.
 * Faqat sukut zichlikda (amallar/tanlov ustuni bor jadval allaqachon `tight`).
 */
const CELL_PAD_BELOW_1440 = "lg:max-[1439px]:px-2 lg:max-[1439px]:first:pl-4 lg:max-[1439px]:last:pr-4";

/** Server sukuti (OpenAPI `GET /orders`: «default created_at desc») — URL'da saralash yo'q bo'lsa shu ko'rinadi. */
const DEFAULT_SORT: DataTableSort = { key: "createdAt", direction: "desc" };
/** Shu sondan ko'p qatorda jadval/kartalar virtualizatsiya qilinadi (F4RSPBwx). */
const ORDERS_VIRTUALIZE_FROM = 30;

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
    // Market tomoni (market va market operatori, MO-3) — market jadvali (maket `market-orders-list`).
    const isMarket = isMarketSideRole(role);
    const hasActions = Boolean(onSellOrder || onCancelOrder || onRollbackOrder);
    const hasSelection = Boolean(isSelectable && onSelectChange && onSelectAll);
    const density = hasActions || hasSelection ? "tight" : isMarket ? "tablet-tight" : "default";
    const cellPad = density === "default" ? CELL_PAD_BELOW_1440 : undefined;
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

    /** Bekor qilingan buyurtma — joy bosqichi belgisi («Bekor · HQ'da»; maket `tizim-states-data` §09). */
    const statusBadges = useCallback(
        (order: OrderListItem) => (
            <>
                <OrderStatusBadge status={getDisplayStatus(order)} order={order} />
                <ReturnRequestedTag order={order} />
                <ExtraCostApprovalTag orderId={order.id} status={order.status} />
                {/* 6kHnNH9j: «Ombordan · <ombor>» — viloyat omboridan ketadigan buyurtma. */}
                <FulfillmentSourceTag order={order} />
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
                className: cellPad,
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
                                {/* rwAy8Qyk: yorliqdagi raqam (`order_number`, «№EL-100081»), zaxira — `№id`. */}
                                {formatOrderRef(order)}
                            </Link>
                            <IconButton
                                size="sm"
                                icon={Copy}
                                label={t("ordersList.copyNumber", { id: orderNumberOf(order) })}
                                // Market jadvali planshetda 736 px ga sig'sin: maket `market-orders-list` da nusxalash yo'q.
                                className={cx("-my-1", isMarket && "max-lg:hidden")}
                                onClick={() => handleCopyOrderId(orderNumberOf(order))}
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
                className: cellPad,
                cell: (order) => (
                    <>
                        <FitText wide text={order.customer?.name} className="font-semibold text-text" />
                        <div className="whitespace-nowrap text-[13px] text-text-muted">
                            {formatPhone(order.customer?.phone_number) || "—"}
                        </div>
                        {isMarket ? (
                            <FitText tabletOnly text={order.district?.name} className="text-[13px] text-text-muted" />
                        ) : null}
                    </>
                ),
            },
            {
                id: "area",
                header: t("ordersList.columns.area"),
                hideBelow: "lg",
                className: cellPad,
                cell: (order) => (
                    <>
                        <FitText text={order.district?.name} />
                        {order.district?.region?.name ? (
                            <FitText text={order.district.region.name} className="text-[13px] text-text-muted" />
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
                className: cellPad,
                cell: (order) => (
                    <FitText text={order.market?.name} />
                ),
            });
        }

        list.push(
            {
                id: "status",
                header: t("ordersList.columns.status"),
                className: cellPad,
                sortable: true,
                // Bosqich belgisi ostida joy va muddat: «Toshkent HQ · 2 kun», «→ Toshkent HQ».
                cell: (order) => (
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex flex-wrap items-center gap-1">{statusBadges(order)}</div>
                        {/* BG7: «Eskalatsiya» / «Marketga eslatildi» — xodim ro'yxatida (market tomonida yo'q). */}
                        <OrderReturnPlace order={order} withHandoverFlags={!isMarket} />
                    </div>
                ),
            },
            {
                id: "delivery",
                header: t("ordersList.columns.delivery"),
                className: cellPad,
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
                className: cellPad,
                sortable: true,
                align: "end",
                cell: (order) => (
                    <>
                        <div className="font-semibold text-text">{money(order.total_price)}</div>
                        {showTabletMarket ? (
                            <div
                                className="ml-auto hidden max-w-[160px] truncate text-[13px] font-normal text-text-muted max-lg:block"
                                title={order.market?.name ?? undefined}
                            >
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
        cellPad,
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
                ? [formatOrderRef(order), order.district?.name ?? "—"]
                : [formatOrderRef(order), order.district?.name ?? "—", order.market?.name ?? "—"];
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
                            {/* Uzun ism kartani cho'zmaydi — ko'pi bilan 2 qator, to'liq matn `title` da (D-02 telefonda). */}
                            <span className="line-clamp-2 min-w-0 font-semibold wrap-break-word" title={order.customer?.name ?? undefined}>
                                {order.customer?.name ?? "—"}
                            </span>
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
                        <OrderReturnPlace order={order} withHandoverFlags={!isMarket} />
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
                    density={density}
                    selection={selection}
                    onRowClick={onRowClick}
                    renderCard={renderCard}
                    busy={busy}
                    className="border-t border-border"
                    // F4RSPBwx: 50 / 100 qator tanlansa faqat ko'rinadiganlari DOM'da (100 da ~7 100 tugun edi).
                    virtualizeFrom={ORDERS_VIRTUALIZE_FROM}
                />
            )}
        </QueryBoundary>
    );
};

export default memo(OrdersTable);
