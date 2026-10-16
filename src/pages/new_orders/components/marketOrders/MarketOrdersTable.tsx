// dizayn-v2: superadmin-neworders-market-orders, admin-neworders-market-detail, manager-new-orders-market-detail, registrator-new-orders-market-detail, market-new-orders-list
import { useCallback, useMemo, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import {
  Badge,
  DataTable,
  IconButton,
  type DataTableColumn,
  type DataTableSelection,
  type DataTableSort,
} from "../../../../shared/ui/primitives";
import { getDeliveryLabelKey } from "../../../orders/list/courier/list/orderActionModel";
import { readOrderDistrict, readOrderRegion, readProductLines, type MarketOrder } from "./marketOrdersModel";

/**
 * Marketning bugungi yangi buyurtmalari jadvali (`.el-table`, telefonda `.el-list` kartalari).
 *
 *  - `staff` — superadmin/admin/menejer/registrator: tanlov belgisi, «Tahrirlash» (havola) + «O'chirish».
 *    Planshetda (< 1024) superadmin/admin «Yetkazish»ni, menejer/registrator «Mahsulotlar»ni qoldiradi
 *    (`compactKeeps`, maketlar `*-market-detail`); menejer/registratorda tuman «Mijoz» ostiga tushadi.
 *  - `market` — o'z ro'yxati (`market-new-orders-list`): tanlovsiz, «O'chirish» + «Ochish» (›).
 */

export type MarketOrdersTableVariant = "staff" | "market";

type MarketOrdersTableProps = {
  variant: MarketOrdersTableVariant;
  rows: readonly MarketOrder[];
  marketId: string;
  /** < 1024 da qaysi ustun qoladi: `delivery` (superadmin/admin) yoki `products` (menejer/registrator). */
  compactKeeps?: "delivery" | "products";
  sort: DataTableSort | null;
  onSortChange: (sort: DataTableSort | null) => void;
  selection?: DataTableSelection<MarketOrder>;
  onRowClick?: (order: MarketOrder) => void;
  onDelete: (order: MarketOrder) => void;
  label: string;
  busy?: boolean;
};

/** Havola ko'rinishidagi ikonka-tugma (`.el-iconbtn`, ghost): `IconButton` bilan bir xil o'lcham va ton. */
const ICON_LINK_SIZE = { sm: "size-8 rounded-lg", md: "size-10 rounded-[10px]" } as const;

const RowIconLink = ({
  to,
  label,
  icon: Icon,
  size = "sm",
  className,
  ...rest
}: Omit<ComponentProps<typeof Link>, "children" | "aria-label" | "title"> & {
  label: string;
  icon: LucideIcon;
  size?: "sm" | "md";
}) => (
  <Link
    {...rest}
    to={to}
    aria-label={label}
    title={label}
    className={cx(
      "inline-flex shrink-0 items-center justify-center text-text-muted max-md:size-11",
      "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text motion-reduce:transition-none",
      ICON_LINK_SIZE[size],
      className,
    )}
  >
    <Icon aria-hidden="true" size={size === "sm" ? 16 : 20} strokeWidth={2} />
  </Link>
);

export const MarketOrdersTable = ({
  variant,
  rows,
  marketId,
  compactKeeps = "delivery",
  sort,
  onSortChange,
  selection,
  onRowClick,
  onDelete,
  label,
  busy,
}: MarketOrdersTableProps) => {
  const { t, i18n } = useTranslation(["newOrders", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isStaff = variant === "staff";

  const editHref = useCallback((order: MarketOrder) => `/new-orders/${marketId}/edit/${order.id}`, [marketId]);
  const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
  const dateTime = useCallback(
    (value: string) => formatDateTimeLocalized(value, { language }),
    [language],
  );
  const qty = useCallback(
    (count: number) => t("marketOrders.itemsQty", { value: formatNumberLocalized(count, { language }) }),
    [language, t],
  );

  const deliveryBadge = useCallback(
    (order: MarketOrder) => {
      const key = getDeliveryLabelKey(order.where_deliver);
      return key ? <Badge>{t(key, { ns: "orders" })}</Badge> : null;
    },
    [t],
  );

  const paidLine = useCallback(
    (order: MarketOrder, className: string) =>
      Number(order.paid_amount) > 0 ? (
        <div className={cx("font-semibold text-success-fg", className)}>
          {t("marketOrders.paidAmount", { amount: money(order.paid_amount) })}
        </div>
      ) : null,
    [money, t],
  );

  const deleteButton = useCallback(
    (order: MarketOrder, size: "sm" | "md") => (
      <IconButton
        size={size}
        icon={Trash2}
        label={t("marketOrders.deleteOrder", { id: order.id })}
        aria-haspopup="dialog"
        onClick={() => onDelete(order)}
      />
    ),
    [onDelete, t],
  );

  const rowActions = useCallback(
    (order: MarketOrder, size: "sm" | "md") =>
      isStaff ? (
        <>
          <RowIconLink to={editHref(order)} size={size} icon={Pencil} label={t("marketOrders.editOrder", { id: order.id })} />
          {deleteButton(order, size)}
        </>
      ) : (
        <>
          {deleteButton(order, size)}
          <RowIconLink
            to={editHref(order)}
            size={size}
            icon={ChevronRight}
            label={t("marketOrders.openOrder", { id: order.id })}
          />
        </>
      ),
    [deleteButton, editHref, isStaff, t],
  );

  const columns = useMemo<DataTableColumn<MarketOrder>[]>(() => {
    const keepsProducts = isStaff && compactKeeps === "products";
    return [
      {
        id: "createdAt",
        header: t("marketOrders.columns.order"),
        sortable: true,
        firstDirection: "desc",
        sortTitle: t("marketOrders.sortByDate"),
        cell: (order) => (
          <>
            <Link
              to={editHref(order)}
              className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
            >
              №{order.id}
            </Link>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(order.createdAt)}</div>
          </>
        ),
      },
      {
        id: "customer",
        header: t("marketOrders.columns.customer"),
        cell: (order) => (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{order.customer?.name ?? "—"}</div>
            <div className="whitespace-nowrap text-[13px] text-text-muted">
              {formatPhone(order.customer?.phone_number) || "—"}
            </div>
            {keepsProducts ? (
              <div className="hidden whitespace-nowrap text-[13px] text-text-muted max-lg:block">
                {readOrderDistrict(order) ?? order.address ?? "—"}
              </div>
            ) : null}
          </>
        ),
      },
      {
        id: "location",
        header: t("marketOrders.columns.location"),
        hideBelow: "lg",
        cell: (order) => (
          <>
            <div className="whitespace-nowrap">{readOrderDistrict(order) ?? order.address ?? "—"}</div>
            {readOrderRegion(order) ? (
              <div className="whitespace-nowrap text-[13px] text-text-muted">{readOrderRegion(order)}</div>
            ) : null}
          </>
        ),
      },
      {
        id: "products",
        header: t("marketOrders.columns.products"),
        hideBelow: keepsProducts ? undefined : "lg",
        cell: (order) => {
          const lines = readProductLines(order);
          if (lines.length === 0) return <span className="text-text-subtle">—</span>;
          return (
            <div className="flex flex-col gap-0.5 text-[13px]">
              {lines.map((line) => (
                <span key={line.key} className="whitespace-nowrap">
                  {line.name} <span className="text-text-muted">· {qty(line.quantity)}</span>
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: "delivery",
        header: t("marketOrders.columns.delivery"),
        hideBelow: keepsProducts ? "lg" : undefined,
        cell: (order) => deliveryBadge(order),
      },
      {
        id: "amount",
        header: t("marketOrders.columns.amount"),
        align: "end",
        cell: (order) => (
          <>
            <div className="font-semibold text-text">{money(order.total_price)}</div>
            {paidLine(order, "text-[13px]")}
          </>
        ),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("marketOrders.columns.actions")}</span>,
        className: isStaff ? "w-24" : "w-[88px]",
        cellClassName: "text-right whitespace-nowrap",
        cell: (order) => <div className="inline-flex items-center gap-0.5">{rowActions(order, "sm")}</div>,
      },
    ];
  }, [compactKeeps, dateTime, deliveryBadge, editHref, isStaff, money, paidLine, qty, rowActions, t]);

  const renderCard = useCallback(
    (order: MarketOrder) => {
      const district = readOrderDistrict(order) ?? order.address;
      const products = readProductLines(order)
        .map((line) => `${line.name} · ${qty(line.quantity)}`)
        .join(", ");
      const name: ReactNode = isStaff ? (
        <span className="min-w-0 font-semibold text-text">{order.customer?.name ?? "—"}</span>
      ) : (
        // Telefonda bosish maydoni ≥ 44 px (qator balandligi o'zgarmaydi).
        <Link
          to={editHref(order)}
          className="-my-2.5 min-w-0 py-2.5 font-semibold text-text hover:text-action-fg hover:underline"
        >
          {order.customer?.name ?? "—"}
        </Link>
      );
      return (
        <div className={cx("flex min-w-0 flex-col gap-1 py-3 pr-4", selection ? "pl-12" : "pl-4")}>
          <span className="flex min-w-0 justify-between gap-2">
            {name}
            <span className="whitespace-nowrap font-semibold text-text">{money(order.total_price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            №{order.id}
            {district ? ` · ${district}` : null}
            {" · "}
            <span className="whitespace-nowrap">{dateTime(order.createdAt)}</span>
          </span>
          {products ? <span className="text-[13px] text-text">{products}</span> : null}
          {paidLine(order, "text-xs")}
          <span className="flex items-center justify-between gap-2">
            {deliveryBadge(order) ?? <span />}
            <span className="-my-1 -mr-3 flex gap-1">{rowActions(order, "md")}</span>
          </span>
        </div>
      );
    },
    [dateTime, deliveryBadge, editHref, isStaff, money, paidLine, qty, rowActions, selection],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(order) => String(order.id)}
      label={label}
      sort={sort}
      onSortChange={onSortChange}
      density={isStaff ? "tight" : "tablet-tight"}
      selection={selection}
      onRowClick={onRowClick}
      renderCard={renderCard}
      busy={busy}
    />
  );
};
