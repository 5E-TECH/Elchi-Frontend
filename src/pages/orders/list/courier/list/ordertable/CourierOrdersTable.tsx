// dizayn-v2: courier-orders-pending, courier-orders-all, courier-orders-cancelled, courier-orders-action-approval-pending
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock, Copy, Phone, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { OrderStatusBadge } from "../../../../../../entities/order";
import {
  clearPendingExtraCostApproval,
  getActivePendingApproval,
  isExtraCostAction,
  usePendingExtraCostApprovals,
  type ExtraCostAction,
} from "../../../../../../entities/orders/extraCostApproval";
import { copyToClipboard } from "../../../../../../shared/lib/clipboard";
import { cx } from "../../../../../../shared/lib/cx";
import { formatDateTimeLocalized, formatTimeLocalized } from "../../../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../../../shared/lib/formatMoney";
import { formatPhone, toTelHref } from "../../../../../../shared/lib/formatPhone";
import { notify } from "../../../../../../shared/lib/notify";
import {
  Badge,
  Button,
  DataTable,
  IconButton,
  type DataTableColumn,
  type DataTableSort,
} from "../../../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../../../shared/ui/primitives/date/useIsPhone";
import {
  getDisplayStatus,
  getRegionName,
  isActiveOrder,
  isRollbackCandidate,
  isSelectableCancelledOrder,
  sortCourierOrders,
  type Order,
} from "./courierOrdersModel";

/**
 * Kuryer buyurtmalari jadvali (maket `courier-orders-pending` · `-all` · `-cancelled`):
 *  - ≥ 1024: Buyurtma (№ + nusxalash, sana) · Mijoz (telefon — qo'ng'iroq havolasi) · Tuman / viloyat ·
 *    Market · Holat (+ «Tasdiq kutilmoqda») · Yetkazish · Summa · Amallar;
 *  - 768–1023: Tuman, Market va Yetkazish yashirin, market nomi summa ostida;
 *  - < 768: kartalar — ism + summa, «№ · tuman · market», badge'lar + sana, o'ngda qo'ng'iroq tugmasi,
 *    pastda amallar (44 px).
 * Saralash sahifa ichida (kuryer ro'yxati API'si saralash parametrini qabul qilmaydi; sukut —
 * yangilari tepada, backend tartibi bilan bir xil).
 */

export type CourierOrdersTableVariant = "pending" | "all" | "cancelled";

export type CourierOrdersSelection = {
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
};

export type CourierOrdersTableProps = {
  variant: CourierOrdersTableVariant;
  orders: Order[];
  /** Jadval/ro'yxat nomi (maketdagi karta nomi). */
  label: string;
  onRowClick?: (order: Order) => void;
  onDeliver?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onRestore?: (order: Order) => void;
  /** Qatorda «Qayta tiklash» ko'rsatiladimi (berilmasa — sotilgan/bekor qilingan hammasida). */
  canRestore?: (order: Order) => boolean;
  /** Faqat «Bekor qilingan» tabida — pochtaga yuborish uchun tanlov. */
  selection?: CourierOrdersSelection;
  /** Fonda yangilanmoqda (sahifa, qidiruv) — ro'yxat xiralashadi. */
  busy?: boolean;
};

const DEFAULT_SORT: DataTableSort = { key: "createdAt", direction: "desc" };

/** `.el-iconbtn.el-iconbtn-lg` — `<a href="tel:">` uchun (IconButton faqat `<button>`). */
const CALL_LINK =
  "absolute right-4 top-3 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-action-fg " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none";

const deliveryKey = (whereDeliver: unknown) => (whereDeliver === "center" ? "deliveryToCenter" : "deliveryToHome");

const ACTION_LABEL_KEYS: Record<ExtraCostAction, string> = {
  sell: "extraCostApprovalActionSell",
  partly_sell: "extraCostApprovalActionPartlySell",
  cancel: "extraCostApprovalActionCancel",
};

/**
 * «Tasdiq kutilmoqda» — qo'shimcha xarajat market tasdig'iga yuborilgan (maket
 * `courier-orders-action-approval-pending`): chegarali ogohlantirish + soat ikonkasi, maslahatda amal,
 * summa va vaqt. Buyurtma holati so'rovdagidan o'zgarsa (market tasdiqladi) — yozuv o'chiriladi.
 */
const ApprovalBadge = ({ order }: { order: Order }) => {
  const { t, i18n } = useTranslation("orders");
  const approvals = usePendingExtraCostApprovals();
  const stored = approvals[order.id];
  const active = getActivePendingApproval(approvals, { id: order.id, status: order.status });

  useEffect(() => {
    if (stored && !active) clearPendingExtraCostApproval(order.id);
  }, [active, order.id, stored]);

  if (!active) return null;

  const requestedAt = new Date(active.requestedAt);
  const sameDay = requestedAt.toDateString() === new Date().toDateString();
  const params = {
    amount: formatMoneyLocalized(active.amount, { language: i18n.language }),
    time: sameDay
      ? formatTimeLocalized(active.requestedAt)
      : formatDateTimeLocalized(active.requestedAt, { language: i18n.language }),
  };
  const title = isExtraCostAction(active.action)
    ? t("extraCostApprovalSentAtAction", { ...params, action: t(ACTION_LABEL_KEYS[active.action]) })
    : t("extraCostApprovalSentAt", params);

  return (
    <Badge tone="warning" variant="outline" icon={Clock} title={title}>
      {t("courierList.approvalPending")}
      <span className="sr-only">. {title}</span>
    </Badge>
  );
};

const CourierOrdersTable = ({
  variant,
  orders,
  label,
  onRowClick,
  onDeliver,
  onCancel,
  onRestore,
  canRestore,
  selection,
  busy = false,
}: CourierOrdersTableProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.language;
  const isPhone = useIsPhone();
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_SORT);
  const rows = useMemo(() => sortCourierOrders(orders, sort), [orders, sort]);
  const withActions = variant !== "cancelled";

  const handleCopy = (id: string) => {
    void copyToClipboard(id).then((copied) => {
      if (copied) notify.success(t("orderNumberCopied"));
      else notify.error(t("orderNumberCopyFailed", { id }));
    });
  };

  // `onRestore` berilmagan jadvalda (Kutilayotgan, `?status=sold` havolasi) «Qayta tiklash» chizilmaydi —
  // aks holda hech narsa qilmaydigan tugma chiqardi.
  const showRestore = (order: Order) =>
    Boolean(onRestore) && isRollbackCandidate(order) && (canRestore ? canRestore(order) : true);

  const nameOf = (order: Order) => order.customer?.name?.trim() || "—";
  const money = (order: Order) => formatMoneyLocalized(Number(order.total_price) || 0, { language });
  const delivery = (order: Order) => <Badge>{t(deliveryKey(order.where_deliver))}</Badge>;
  const status = (order: Order) => <OrderStatusBadge status={getDisplayStatus(order)} />;

  /** Jadval qatoridagi amallar (maket: `el-btn-sm`, planshetda «Bekor»). */
  const rowActions = (order: Order): ReactNode => {
    if (isActiveOrder(order)) {
      return (
        <div className="flex gap-2">
          <Button
            variant="success-soft"
            size="sm"
            aria-haspopup="dialog"
            aria-label={t("courierList.sellRow", { id: order.id })}
            onClick={() => onDeliver?.(order)}
          >
            {t("courierList.sell")}
          </Button>
          <Button
            variant="danger-soft"
            size="sm"
            aria-haspopup="dialog"
            aria-label={t("courierList.cancelRow", { id: order.id })}
            onClick={() => onCancel?.(order)}
          >
            <span className="lg:hidden">{t("courierList.cancelShort")}</span>
            <span className="max-lg:hidden">{t("courierList.cancel")}</span>
          </Button>
        </div>
      );
    }
    if (showRestore(order)) {
      return (
        <Button
          variant="secondary"
          size="sm"
          compact
          leftIcon={RotateCcw}
          aria-haspopup="dialog"
          title={t("courierList.restoreTitle")}
          aria-label={t("courierList.restoreRow", { id: order.id })}
          onClick={() => onRestore?.(order)}
        >
          {t("courierList.restore")}
        </Button>
      );
    }
    return (
      <span className="text-text-subtle">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("courierList.noAction")}</span>
      </span>
    );
  };

  /** Telefon kartasidagi amallar (44 px, maket `courier-orders-*` telefon). */
  const cardActions = (order: Order): ReactNode => {
    const name = nameOf(order);
    if (isActiveOrder(order)) {
      return (
        <div className="flex gap-2 px-4 pb-3">
          <Button
            variant="success-soft"
            className="flex-1"
            aria-haspopup="dialog"
            aria-label={t("courierList.sellCard", { name })}
            onClick={() => onDeliver?.(order)}
          >
            {t("courierList.sell")}
          </Button>
          <Button
            variant="danger-soft"
            className="flex-1"
            aria-haspopup="dialog"
            aria-label={t("courierList.cancelCard", { name })}
            onClick={() => onCancel?.(order)}
          >
            {t("courierList.cancel")}
          </Button>
        </div>
      );
    }
    if (showRestore(order)) {
      return (
        <div className="flex justify-end px-4 pb-3">
          <Button
            variant="secondary"
            leftIcon={RotateCcw}
            aria-haspopup="dialog"
            aria-label={t("courierList.restoreCard", { name })}
            onClick={() => onRestore?.(order)}
          >
            {t("courierList.restore")}
          </Button>
        </div>
      );
    }
    return null;
  };

  const columns: DataTableColumn<Order>[] = [
    {
      id: "createdAt",
      header: t("courierList.colOrder"),
      sortable: true,
      firstDirection: "desc",
      sortTitle: t("courierList.sortByDate"),
      cell: (order) => (
        <>
          <div className="flex items-center gap-0.5">
            <Link to={`edit/${order.id}`} className="whitespace-nowrap font-semibold text-text">
              №{order.id}
            </Link>
            <IconButton
              size="sm"
              icon={Copy}
              label={t("courierList.copyNumber", { id: order.id })}
              className="-my-1 max-lg:hidden"
              onClick={() => handleCopy(order.id)}
            />
          </div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">
            {formatDateTimeLocalized(order.created_at, { language })}
          </div>
        </>
      ),
    },
    {
      id: "customer",
      header: t("courierList.colCustomer"),
      cell: (order) => {
        const name = nameOf(order);
        const phone = order.customer?.phone_number;
        const href = toTelHref(phone);
        return (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{name}</div>
            {href ? (
              <a
                href={href}
                aria-label={t("courierList.call", { name, phone: formatPhone(phone) })}
                className="whitespace-nowrap text-[13px] text-text-muted hover:text-text"
              >
                {formatPhone(phone)}
              </a>
            ) : (
              <div className="whitespace-nowrap text-[13px] text-text-muted">{formatPhone(phone)}</div>
            )}
          </>
        );
      },
    },
    {
      id: "area",
      header: t("courierList.colArea"),
      hideBelow: "lg",
      cell: (order) => (
        <>
          <div className="whitespace-nowrap">{order.district?.name || "—"}</div>
          {getRegionName(order) ? (
            <div className="whitespace-nowrap text-[13px] text-text-muted">{getRegionName(order)}</div>
          ) : null}
        </>
      ),
    },
    {
      id: "market",
      header: t("courierList.colMarket"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (order) => order.market?.name || "—",
    },
    {
      id: "status",
      header: t("courierList.colStatus"),
      cell: (order) => (
        <div className="flex flex-col items-start gap-1">
          {status(order)}
          <ApprovalBadge order={order} />
        </div>
      ),
    },
    {
      id: "delivery",
      header: t("courierList.colDelivery"),
      hideBelow: "lg",
      cell: delivery,
    },
    {
      id: "total_price",
      header: t("courierList.colAmount"),
      align: "end",
      sortable: true,
      cell: (order) => (
        <>
          <div className="font-semibold text-text">{money(order)}</div>
          <div className="hidden text-[13px] text-text-muted max-lg:block">{order.market?.name || "—"}</div>
        </>
      ),
    },
    ...(withActions
      ? [
          {
            id: "actions",
            header: t("courierList.colActions"),
            className: "whitespace-nowrap",
            cell: rowActions,
          } satisfies DataTableColumn<Order>,
        ]
      : []),
  ];

  const isSelected = (order: Order) => Boolean(selection?.selectedIds.has(order.id));

  const renderCard = (order: Order) => {
    const name = nameOf(order);
    const phone = order.customer?.phone_number;
    const href = toTelHref(phone);
    const actions = withActions ? cardActions(order) : null;
    const selected = selection ? isSelectableCancelledOrder(order) && isSelected(order) : false;
    return (
      <>
        <Link
          to={`edit/${order.id}`}
          className={cx(
            "flex min-w-0 flex-col gap-1 pr-4 pt-3 text-text",
            selection ? "pl-14" : "pl-4",
            actions ? "pb-2" : "pb-3",
          )}
        >
          <span className="flex items-baseline justify-between gap-2 pr-14">
            <span className="min-w-0 font-semibold">{name}</span>
            <span className="whitespace-nowrap font-semibold">{money(order)}</span>
          </span>
          <span className="pr-14 text-[13px] text-text-muted">
            №{order.id} · {order.district?.name || "—"} ·{" "}
            <span className="whitespace-nowrap">{order.market?.name || "—"}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {status(order)}
            <ApprovalBadge order={order} />
            {delivery(order)}
            <span className="ml-auto whitespace-nowrap text-xs text-text-muted">
              {formatDateTimeLocalized(order.created_at, { language })}
            </span>
          </span>
        </Link>
        {href ? (
          <a
            href={href}
            aria-label={t("courierList.call", { name, phone: formatPhone(phone) })}
            className={cx(CALL_LINK, selected ? "bg-surface" : "bg-action-soft")}
          >
            <Phone aria-hidden="true" size={20} strokeWidth={2} />
          </a>
        ) : null}
        {actions}
      </>
    );
  };

  const selectableCount = selection ? rows.filter(isSelectableCancelledOrder).length : 0;
  const selectedCount = selection ? rows.filter((order) => isSelectableCancelledOrder(order) && isSelected(order)).length : 0;

  return (
    <>
      {selection && isPhone ? (
        // Telefonda jadval sarlavhasi yo'q — «Barchasini tanlash» ro'yxat ustida (maket `courier-orders-cancelled`).
        <div className="flex items-center gap-3 border-b border-border pr-4">
          <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 pl-5 text-sm font-semibold text-text">
            <input
              type="checkbox"
              className="size-[18px] cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45"
              checked={selectableCount > 0 && selectedCount === selectableCount}
              disabled={selectableCount === 0}
              ref={(element) => {
                if (element) element.indeterminate = selectedCount > 0 && selectedCount < selectableCount;
              }}
              onChange={(event) => selection.onSelectAll(event.target.checked)}
            />
            {t("courierList.selectAll")}
          </label>
          <span className="text-[13px] text-text-muted">
            {t("courierList.selectionCountShort", { selected: selectedCount, total: selectableCount })}
          </span>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(order) => order.id}
        label={label}
        cardsLabel={label}
        sort={sort}
        onSortChange={setSort}
        density="tight"
        busy={busy}
        onRowClick={onRowClick ? (order) => onRowClick(order) : undefined}
        renderCard={renderCard}
        selection={
          selection
            ? {
                isSelected,
                isSelectable: isSelectableCancelledOrder,
                onToggle: (order, checked) => selection.onSelectChange(order.id, checked),
                onToggleAll: selection.onSelectAll,
                headerLabel: t("courierList.selectAllPage"),
                rowLabel: (order) => t("courierList.selectRow", { id: order.id }),
              }
            : undefined
        }
      />
    </>
  );
};

export default memo(CourierOrdersTable);
