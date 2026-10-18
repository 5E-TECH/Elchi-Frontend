// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-refused, superadmin-mails-detail-old, admin-mails-detail, admin-mails-refused-detail, admin-mails-old-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, manager-mails-detail-old, registrator-mails-detail, registrator-mails-detail-refused, registrator-mails-detail-old, courier-mails-detail-receive, courier-mails-detail-refused, courier-mails-detail-old
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ListChecks, ScanLine, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PostOrder } from "../../../../entities/mails";
import { OrderStatusBadge } from "../../../../entities/order";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  type DataTableColumn,
  type DataTableSelection,
  type DataTableSort,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import { SelectionRegion } from "../../../../shared/ui/SelectionRegion";
import type { PrintMode } from "../lib/printMode";
import { orderRowDate, useOrderRowView } from "../model/useOrderRowView";
import OrderRow, { RowPrintButton } from "./OrderRow";

/**
 * POCHTADAGI BUYURTMALAR KARTASI — dizayn v2 (`.el-card` + `.el-table` / telefonda `.el-list`).
 *
 *   sarlavha («Buyurtmalar» ⟨N ta⟩) · skaner izohi (`ScanLine`) · o'ngda «USB skaner tayyor» / `headerExtra`
 *   tanlov paneli (`SelectionRegion`: «6 ta buyurtma tanlandi / 9 ta», «Barchasini tanlash», «Tanlovni bekor qilish»)
 *   jadval (`DataTable`, tanlov belgilari, qator chop etish va o'chirish) — telefonda kartalar (`OrderRow`)
 *   pastda «N ta buyurtma» · «Jami: X»
 *
 * Maketlar: `superadmin-mails-detail` (jo'natish), `*-refused` (qabul), `*-old` / `admin-mails-old-detail`
 * (tarix: belgi va «Holat» yo'q), `manager-mails-detail-receive`, `courier-mails-detail-*`. Paket tafsiloti
 * (`pages/batches/ui/BatchDetailPage.tsx`) ham shu kartani ishlatadi — mavjud prop nomlari muzlatilgan,
 * yangilari ixtiyoriy va sukut qiymati pochta tafsilotini beradi.
 *
 * `readOnly` — tanlov yo'q (belgi ustuni, panel); `variant="history"` — eski pochta (sana faqat kun, «Holat» yo'q,
 * telefonda butun karta havola). `cardVariant="courier"` — kuryer maketi: telefonda tanlov paneli o'rnida
 * «Barchasini tanlash» qatori, kartada telefon raqami va vaqt, chegarali 44 px chop etish tugmasi.
 */
export type OrdersTableColumn =
  | "order"
  | "customer"
  | "districtAddress"
  | "district"
  | "address"
  | "market"
  | "status"
  | "delivery"
  | "amount";

/** Pochta tafsiloti (jo'natish / qabul / rad etilgan) — maket `superadmin-mails-detail`. */
const MAIL_ORDER_COLUMNS: readonly OrdersTableColumn[] = [
  "order",
  "customer",
  "districtAddress",
  "market",
  "status",
  "delivery",
  "amount",
];

/** Eski pochta (tarix) — belgi va «Holat» yo'q (maket `admin-mails-old-detail`). */
const MAIL_HISTORY_COLUMNS: readonly OrdersTableColumn[] = [
  "order",
  "customer",
  "districtAddress",
  "market",
  "delivery",
  "amount",
];

/** Planshetda (< 1024) yashirinadigan ustunlar — sukut (maket `superadmin-mails-detail` planshet). */
const DEFAULT_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["districtAddress", "district", "address", "market", "delivery"];
/** Eski pochta planshetda: faqat «Market» yashirin, u «Summa» ostiga tushadi (maket `admin-mails-old-detail`). */
const HISTORY_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["district", "address", "market"];

interface OrdersTableProps {
  orders: PostOrder[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onPrintOne?: (order: PostOrder, mode: PrintMode) => void;
  onDeleteOne?: (orderId: string) => void;
  canDelete?: boolean;
  variant?: "default" | "history";
  readOnly?: boolean;
  /** Karta sarlavhasi (sukut «Buyurtmalar»). */
  title?: ReactNode;
  /** Karta nomi (`aria-label`, sukut «Pochtadagi buyurtmalar»). */
  ariaLabel?: string;
  /** Sarlavha qatori o'ngida (masalan «Faqat o'qish»). */
  headerExtra?: ReactNode;
  /** Sarlavha ostidagi skaner izohi (`ScanLine` bilan). */
  scanHint?: ReactNode;
  /** USB skaner tinglayapti — «USB skaner tayyor» belgisi. */
  scannerReady?: boolean;
  /** Skaner belgisi matni (sukut «USB skaner tayyor»; rad etilganda «Skaner tayyor»). */
  scannerReadyLabel?: ReactNode;
  /** Tanlov paneli izohi (`readOnly` da panel yo'q). */
  selectionHint?: ReactNode;
  /** «Tanlovni bekor qilish» (berilmasa tugma yo'q). */
  onClearSelection?: () => void;
  /** Ustunlar tartibi; belgi — `readOnly=false` da, chop etish — `onPrintOne` bilan, savat — `canDelete` bilan. */
  columns?: readonly OrdersTableColumn[];
  /** < 1024 da yashirinadigan ustunlar (sukut — maket `superadmin-mails-detail`). */
  tabletHidden?: readonly OrdersTableColumn[];
  /** Buyurtma raqami havolasi (sukut `/orders/edit/:id`); `null` — oddiy matn (kuryer). */
  orderHref?: ((order: PostOrder) => string) | null;
  /** Bo'sh holat (sukut — «Buyurtmalar topilmadi»). */
  empty?: ReactNode;
  /** Pastki qism «N ta buyurtma» · «Jami: X» (sukut `true`). */
  footer?: boolean;
  /** Faqat telefonda (< 768), pastki qism ostida — masalan «HQ'ga yuborish — n ta». */
  footerAction?: ReactNode;
  /** Mijoz tomonida saralash: «Buyurtma» (sana) va «Summa» (kuryer maketlari). */
  sortable?: boolean;
  /** Telefon kartasi va tanlov qatori ko'rinishi (sukut — xodim maketi). */
  cardVariant?: "default" | "courier";
  /** Sarlavha ostidagi izoh qatori (kuryer: «Rad etilgan pochtani filial qabul qiladi.»). */
  notice?: ReactNode;
  /** Faqat telefonda, sarlavha ostida (kuryer: «Barchasini chop etish»). */
  phoneHeaderAction?: ReactNode;
  /** Kuryer telefonidagi «Barchasini tanlash» qatori o'ngida (chop etish menyusi). */
  phoneSelectionAction?: ReactNode;
  /** Qator chop etish tugmasi nomi (sukut «№X ni chop etish»). */
  printLabel?: (order: PostOrder) => string;
  /**
   * Paket tafsiloti ko'rinishi (`pages/batches`): telefon kartasida «№X · [market ·] telefon» + manzil (market —
   * faqat `columns` da «market» bo'lsa), pastki qism «Jami N ta buyurtma» · summa (maket `*-batches-detail*`).
   * Sukut `"mail"` — pochta tafsiloti.
   */
  appearance?: "mail" | "batch";
  /** «USB skaner tayyor» belgisi telefonda ham (maket `manager-returns-batch-detail`); sukut — faqat ≥ 768. */
  scannerReadyOnPhone?: boolean;
}

const defaultOrderHref = (order: PostOrder) => `/orders/edit/${order.id}`;

/** Mijoz tomonidagi saralash qiymati (sana — ko'rsatilgan sana, summa — `total_price`). */
const sortValue = (order: PostOrder, key: string) =>
  key === "amount" ? Number(order.total_price) || 0 : new Date(orderRowDate(order) ?? 0).getTime() || 0;

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
const OrdersTable = memo(
  ({
    orders,
    selectedIds,
    allSelected,
    someSelected,
    onToggleAll,
    onToggleOne,
    onPrintOne,
    onDeleteOne,
    canDelete = false,
    variant = "default",
    readOnly = false,
    title,
    ariaLabel,
    headerExtra,
    scanHint,
    scannerReady = false,
    scannerReadyLabel,
    selectionHint,
    onClearSelection,
    columns,
    tabletHidden,
    orderHref = defaultOrderHref,
    empty,
    footer = true,
    footerAction,
    sortable = false,
    cardVariant = "default",
    notice,
    phoneHeaderAction,
    phoneSelectionAction,
    printLabel,
    appearance = "mail",
    scannerReadyOnPhone = false,
  }: OrdersTableProps) => {
    const { t, i18n } = useTranslation(["mails", "orders"]);
    const language = i18n.resolvedLanguage ?? i18n.language;
    const isPhone = useIsPhone();
    const isHistory = variant === "history";
    const isCourierCard = cardVariant === "courier";
    const selectable = !readOnly && !isHistory;
    const [sort, setSort] = useState<DataTableSort | null>(sortable ? { key: "order", direction: "desc" } : null);

    const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
    const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
    const view = useOrderRowView({ history: isHistory });
    const rowPrintLabel = useCallback(
      (order: PostOrder) => printLabel?.(order) ?? t("detailPage.printRow", { id: order.id }),
      [printLabel, t],
    );

    const columnIds = columns ?? (isHistory ? MAIL_HISTORY_COLUMNS : MAIL_ORDER_COLUMNS);
    const hiddenOnTablet = useMemo(
      () => new Set(tabletHidden ?? (isHistory ? HISTORY_TABLET_HIDDEN : DEFAULT_TABLET_HIDDEN)),
      [isHistory, tabletHidden],
    );
    // Planshetda yashirin ustun ma'lumoti qo'shni katakka tushadi (maket `.el-show-tablet`).
    const tabletPlaceUnderCustomer =
      columnIds.some((id) => (id === "districtAddress" || id === "district" || id === "address") && hiddenOnTablet.has(id));
    const tabletMarketUnderAmount = columnIds.includes("market") && hiddenOnTablet.has("market");
    const isBatch = appearance === "batch";
    const showsMarket = columnIds.includes("market");

    const rows = useMemo(() => {
      if (!sort) return orders;
      const direction = sort.direction === "asc" ? 1 : -1;
      return [...orders].sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * direction);
    }, [orders, sort]);

    const selectedOrders = useMemo(() => orders.filter((order) => selectedIds.has(order.id)), [orders, selectedIds]);
    const totalSum = useMemo(() => orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0), [orders]);
    const hasActions = Boolean(onPrintOne) || (canDelete && Boolean(onDeleteOne));

    const deleteButton = useCallback(
      (order: PostOrder) =>
        canDelete && onDeleteOne ? (
          <IconButton
            size="sm"
            variant="danger"
            icon={Trash2}
            label={t("deleteFromPostAction", { id: order.id })}
            aria-haspopup="dialog"
            onClick={() => onDeleteOne(order.id)}
          />
        ) : null,
      [canDelete, onDeleteOne, t],
    );

    const rowActions = useCallback(
      (order: PostOrder) => (
        <>
          {onPrintOne ? (
            <RowPrintButton
              label={rowPrintLabel(order)}
              onSelect={(mode) => onPrintOne(order, mode)}
              bordered={isCourierCard && isPhone}
            />
          ) : null}
          {deleteButton(order)}
        </>
      ),
      [deleteButton, isCourierCard, isPhone, onPrintOne, rowPrintLabel],
    );

    const cell = useCallback(
      (id: OrdersTableColumn): DataTableColumn<PostOrder> => {
        const header = t(`detailPage.columns.${id}`);
        const hideBelow = hiddenOnTablet.has(id) ? ("lg" as const) : undefined;
        switch (id) {
          case "order":
            return {
              id,
              header,
              sortable,
              firstDirection: "desc",
              sortTitle: t("detailPage.sortByDate"),
              cell: (order) => (
                <>
                  {orderHref ? (
                    <Link
                      to={orderHref(order)}
                      className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
                    >
                      №{order.id}
                    </Link>
                  ) : (
                    <div className="whitespace-nowrap font-semibold text-text">№{order.id}</div>
                  )}
                  <div className="whitespace-nowrap text-[13px] text-text-muted">{view.date(order)}</div>
                </>
              ),
            };
          case "customer":
            return {
              id,
              header,
              cell: (order) => {
                const place = view.place(order);
                return (
                  <>
                    <div className="whitespace-nowrap font-semibold text-text">{view.customerName(order)}</div>
                    <div className="whitespace-nowrap text-[13px] text-text-muted">{view.customerPhone(order)}</div>
                    {tabletPlaceUnderCustomer && place ? (
                      <div className="hidden whitespace-nowrap text-[13px] text-text-muted max-lg:block">{place}</div>
                    ) : null}
                  </>
                );
              },
            };
          case "districtAddress":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => (
                <>
                  <div className="whitespace-nowrap">{view.district(order) ?? view.address(order) ?? "—"}</div>
                  {view.district(order) && view.address(order) ? (
                    <div className="max-w-[240px] truncate text-[13px] text-text-muted">{view.address(order)}</div>
                  ) : null}
                </>
              ),
            };
          case "district":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => <span className="whitespace-nowrap">{view.district(order) ?? "—"}</span>,
            };
          case "address":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => (
                <>
                  <div className="max-w-[260px] truncate">{view.address(order) ?? view.district(order) ?? "—"}</div>
                  {view.address(order) && view.district(order) ? (
                    <div className="whitespace-nowrap text-[13px] text-text-muted">{view.district(order)}</div>
                  ) : null}
                </>
              ),
            };
          case "market":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => <span className="whitespace-nowrap">{view.market(order) ?? "—"}</span>,
            };
          case "status":
            return { id, header, hideBelow, cell: (order) => <OrderStatusBadge status={order.status} /> };
          case "delivery":
            return { id, header, hideBelow, cell: (order) => view.deliveryBadge(order) };
          case "amount":
            return {
              id,
              header,
              align: "end",
              sortable,
              firstDirection: "desc",
              sortTitle: t("detailPage.sortByAmount"),
              cell: (order) => (
                <>
                  <div className="font-semibold text-text">{money(order.total_price)}</div>
                  {tabletMarketUnderAmount && view.market(order) ? (
                    <div className="hidden text-[13px] font-normal text-text-muted max-lg:block">{view.market(order)}</div>
                  ) : null}
                </>
              ),
            };
          default:
            return { id, header, cell: () => null };
        }
      },
      [hiddenOnTablet, money, orderHref, sortable, t, tabletMarketUnderAmount, tabletPlaceUnderCustomer, view],
    );

    const tableColumns = useMemo<DataTableColumn<PostOrder>[]>(() => {
      const list = columnIds.map(cell);
      if (hasActions) {
        list.push({
          id: "actions",
          header: <span className="sr-only">{t("detailPage.columns.actions")}</span>,
          className: canDelete ? "w-[88px]" : "w-14",
          cellClassName: "text-right whitespace-nowrap",
          cell: (order) => <div className="inline-flex items-center gap-0.5">{rowActions(order)}</div>,
        });
      }
      return list;
    }, [canDelete, cell, columnIds, hasActions, rowActions, t]);

    const selection = useMemo<DataTableSelection<PostOrder> | undefined>(
      () =>
        selectable
          ? {
              isSelected: (order) => selectedIds.has(order.id),
              onToggle: (order) => onToggleOne(order.id),
              onToggleAll: () => onToggleAll(),
              headerLabel: t("detailPage.selectAllRows"),
              rowLabel: (order) => t("detailPage.selectRow", { id: order.id }),
            }
          : undefined,
      [onToggleAll, onToggleOne, selectable, selectedIds, t],
    );

    const renderCard = useCallback(
      (order: PostOrder) => (
        <OrderRow
          order={order}
          view={view}
          selectable={selectable}
          history={isHistory}
          courier={isCourierCard}
          href={orderHref && !isCourierCard ? orderHref(order) : null}
          actions={hasActions ? rowActions(order) : null}
          meta={isBatch ? "contact" : "place"}
          showMarket={showsMarket}
        />
      ),
      [hasActions, isBatch, isCourierCard, isHistory, orderHref, rowActions, selectable, showsMarket, view],
    );

    // «Barchasini tanlash» — barchasini tanlaydi (hammasi tanlangan bo'lsa o'chiq); bekor qilish — alohida tugma.
    const selectAll = () => {
      if (!allSelected) onToggleAll();
    };
    const selectedCount = selectedOrders.length;
    const hasSelection = selectedCount > 0;

    const selectionActions = (
      <>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={ListChecks}
          disabled={orders.length === 0 || allSelected}
          onClick={selectAll}
          className="max-md:px-2"
        >
          {t("detailPage.selectAll")}
        </Button>
        {onClearSelection ? (
          <Button variant="ghost" size="sm" disabled={!hasSelection} onClick={onClearSelection} className="max-md:px-2">
            {t("detailPage.clearSelection")}
          </Button>
        ) : null}
      </>
    );

    const selectionRegion =
      selectable && orders.length > 0 ? (
        isCourierCard && isPhone ? (
          // Kuryer telefoni: «Barchasini tanlash» belgisi + o'ngda chop etish (maket `courier-mails-detail-receive`).
          <div
            role="region"
            aria-label={t("detailPage.selectionRegion")}
            className={cx(
              "flex items-center justify-between gap-2 border-t border-border px-4 py-2",
              hasSelection ? "bg-action-soft" : "bg-sunken",
            )}
          >
            <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-[18px] shrink-0 cursor-pointer accent-action"
                checked={allSelected}
                ref={(element) => {
                  if (element) element.indeterminate = someSelected && !allSelected;
                }}
                aria-label={t("detailPage.selectAllRows")}
                onChange={onToggleAll}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-text">{t("detailPage.selectAll")}</span>
                <span className="text-xs text-text-muted" aria-live="polite">
                  {t("detailPage.phoneSelectAllHint", { selected: count(selectedCount), total: count(orders.length) })}
                </span>
              </span>
            </label>
            {phoneSelectionAction}
          </div>
        ) : (
          <SelectionRegion
            idle={!hasSelection}
            inline={isCourierCard}
            label={t("detailPage.selectionRegion")}
            title={
              hasSelection ? (
                <>
                  {t("detailPage.selectionTitle", { value: count(selectedCount), count: selectedCount })}{" "}
                  <span className="font-normal text-text-muted">
                    {t("detailPage.selectionOf", { value: count(orders.length), count: orders.length })}
                  </span>
                </>
              ) : (
                t("detailPage.selectionNone")
              )
            }
            hint={hasSelection ? selectionHint : t("detailPage.selectionNoneHint")}
            action={selectionActions}
          />
        )
      ) : null;

    const headerBadge: ReactNode = scannerReady ? (
      <Badge
        tone="success"
        dot
        role="status"
        title={t("detailPage.scannerReadyTitle")}
        className={scannerReadyOnPhone ? undefined : "max-md:hidden"}
      >
        {scannerReadyLabel ?? t("detailPage.scannerReady")}
      </Badge>
    ) : null;

    const hasEmpty = orders.length === 0;
    const hasHeaderSide = headerBadge != null || headerExtra != null;

    return (
      <Card as="section" padding="none" aria-label={ariaLabel ?? t("detailPage.ordersAria")}>
        {/* Sarlavha qatori (`.el-card-head` chiziqsiz — ostidagi tanlov paneli/jadval o'z chizig'i bilan). */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 max-md:px-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text">{title ?? t("detailPage.ordersTitle")}</h2>
              <Badge>{t("detailPage.countBadge", { value: count(orders.length), count: orders.length })}</Badge>
            </div>
            {scanHint ? (
              <p className="flex min-w-0 items-start gap-1.5 text-xs text-text-muted">
                <ScanLine aria-hidden="true" size={14} className="mt-px shrink-0" />
                <span className="min-w-0">{scanHint}</span>
              </p>
            ) : null}
          </div>
          {hasHeaderSide ? (
            <div className="flex flex-wrap items-center gap-2">
              {headerBadge}
              {headerExtra}
            </div>
          ) : null}
          {phoneHeaderAction ? <div className="w-full md:hidden">{phoneHeaderAction}</div> : null}
        </div>

        {notice ? (
          <p
            role="note"
            className="flex min-w-0 items-center gap-2 border-t border-border bg-sunken px-5 py-2.5 text-[13px] text-text-muted max-md:px-4"
          >
            {notice}
          </p>
        ) : null}

        {hasEmpty ? (
          <div className="border-t border-border">
            {empty ?? <EmptyState title={t("emptyOrders")} description={t("emptyOrdersHint")} />}
          </div>
        ) : (
          <>
            {selectionRegion}
            <DataTable
              rows={rows}
              columns={tableColumns}
              getRowKey={(order) => String(order.id)}
              label={ariaLabel ?? t("detailPage.ordersAria")}
              sort={sortable ? sort : undefined}
              onSortChange={sortable ? setSort : undefined}
              density="tight"
              selection={selection}
              // Qator (telefonda karta) bosilsa — tanlov (v1 dagidek); havola, tugma va belgi o'z ishini qiladi.
              onRowClick={selectable ? (order) => onToggleOne(order.id) : undefined}
              renderCard={renderCard}
              className="border-t border-border"
            />
            {footer ? (
              <div
                className={cx(
                  "flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[13px] text-text-muted max-md:px-4",
                  isCourierCard && "max-md:hidden",
                )}
              >
                {isBatch ? (
                  <>
                    <span>{t("detailPage.footerCountTotal", { value: count(orders.length), count: orders.length })}</span>
                    <span className="font-semibold text-text">{money(totalSum)}</span>
                  </>
                ) : (
                  <>
                    <span>{t("detailPage.footerCount", { value: count(orders.length), count: orders.length })}</span>
                    <span>
                      {t("detailPage.footerTotal")} <span className="font-semibold text-text">{money(totalSum)}</span>
                    </span>
                  </>
                )}
              </div>
            ) : null}
            {footerAction ? <div className="border-t border-border px-4 py-3 md:hidden">{footerAction}</div> : null}
          </>
        )}
      </Card>
    );
  },
);
OrdersTable.displayName = "OrdersTable";

export default OrdersTable;
