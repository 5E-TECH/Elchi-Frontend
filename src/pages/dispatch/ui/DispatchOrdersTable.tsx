// dizayn-v2: registrator-dispatch-list, manager-dispatch-scan
import { useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../entities/order";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Badge, DataTable, IconButton, type DataTableColumn } from "../../../shared/ui/primitives";
import type { DispatchOrder } from "../model/dispatchModel";

type DispatchOrdersTableProps = {
  rows: readonly DispatchOrder[];
  selectedIds: ReadonlySet<string>;
  onToggle: (orderId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onRemove: (orderId: string) => void;
};

/**
 * Skanerlangan buyurtmalar jadvali (`.el-table` + `.el-col-check`; telefonda `.el-list` kartalari).
 * Maketlar `registrator-dispatch-list`, `manager-dispatch-scan`.
 *
 *  - Planshetda (< 1024) «Tuman / viloyat», «Market», «Yetkazish» yashirin — «Mijoz» ostida «tuman · yetkazish».
 *  - Qatorni bosish — tanlov (belgi bilan bir xil amal; klaviaturada belgining o'zi).
 *  - «№…» oddiy matn: ro'yxat faqat shu sahifa xotirasida — tafsilotga o'tilsa skanerlanganlar yo'qoladi
 *    (yangi tabda esa sessiya yo'q: token `sessionStorage` da).
 */
export const DispatchOrdersTable = ({ rows, selectedIds, onToggle, onToggleAll, onRemove }: DispatchOrdersTableProps) => {
  const { t, i18n } = useTranslation(["dispatch", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string | null) => formatDateTimeLocalized(value, { language }), [language]);
  const deliveryLabel = useCallback(
    (order: DispatchOrder) =>
      order.deliveryKind === "home"
        ? t("orders:deliveryToHome")
        : order.deliveryKind === "center"
          ? t("orders:deliveryToCenter")
          : null,
    [t],
  );
  const removeButton = useCallback(
    (order: DispatchOrder, size: "sm" | "md") => (
      <IconButton
        size={size}
        icon={X}
        label={t("table.remove", { id: order.id })}
        onClick={() => onRemove(order.id)}
      />
    ),
    [onRemove, t],
  );

  const columns = useMemo<DataTableColumn<DispatchOrder>[]>(
    () => [
      {
        id: "order",
        header: t("table.order"),
        cell: (order) => (
          <>
            <div className="whitespace-nowrap font-semibold text-text">№{order.id}</div>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(order.createdAt)}</div>
          </>
        ),
      },
      {
        id: "customer",
        header: t("table.customer"),
        cell: (order) => {
          const tabletLine = [order.district, deliveryLabel(order)].filter(Boolean).join(" · ");
          return (
            <>
              <div className="whitespace-nowrap font-semibold text-text">{order.name ?? "—"}</div>
              <div className="whitespace-nowrap text-[13px] text-text-muted max-lg:hidden">{formatPhone(order.phone)}</div>
              <div className="hidden whitespace-nowrap text-[13px] text-text-muted max-lg:block">{tabletLine || "—"}</div>
            </>
          );
        },
      },
      {
        id: "location",
        header: t("table.location"),
        hideBelow: "lg",
        cell: (order) => (
          <>
            <div className="whitespace-nowrap">{order.district ?? "—"}</div>
            {order.region ? <div className="whitespace-nowrap text-[13px] text-text-muted">{order.region}</div> : null}
          </>
        ),
      },
      {
        id: "market",
        header: t("table.market"),
        hideBelow: "lg",
        cellClassName: "whitespace-nowrap",
        cell: (order) => order.market ?? "—",
      },
      {
        id: "delivery",
        header: t("table.delivery"),
        hideBelow: "lg",
        cell: (order) => {
          const label = deliveryLabel(order);
          return label ? <Badge>{label}</Badge> : <span className="text-text-subtle">—</span>;
        },
      },
      {
        id: "status",
        header: t("table.status"),
        cell: (order) => (order.status ? <OrderStatusBadge status={order.status} /> : <span className="text-text-subtle">—</span>),
      },
      {
        id: "amount",
        header: t("table.amount"),
        align: "end",
        cellClassName: "font-semibold",
        cell: (order) => money(order.amount),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("table.actions")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (order) => removeButton(order, "sm"),
      },
    ],
    [dateTime, deliveryLabel, money, removeButton, t],
  );

  const renderCard = useCallback(
    (order: DispatchOrder) => {
      const place = [order.district, order.market].filter(Boolean).join(" · ");
      const delivery = deliveryLabel(order);
      return (
        <div className="flex min-w-0 items-start gap-1 py-3 pl-12 pr-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 justify-between gap-2">
              <span className="min-w-0 font-semibold text-text">{order.name ?? "—"}</span>
              <span className="whitespace-nowrap font-semibold text-text">{money(order.amount)}</span>
            </span>
            <span className="text-[13px] text-text-muted">
              №{order.id} · <span className="whitespace-nowrap">{dateTime(order.createdAt)}</span>
            </span>
            {place ? <span className="text-[13px] text-text-muted">{place}</span> : null}
            <span className="flex flex-wrap gap-1.5">
              {order.status ? <OrderStatusBadge status={order.status} /> : null}
              {delivery ? <Badge>{delivery}</Badge> : null}
            </span>
          </div>
          <span className="-mt-2.5 shrink-0">{removeButton(order, "md")}</span>
        </div>
      );
    },
    [dateTime, deliveryLabel, money, removeButton],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(order) => order.id}
      label={t("table.label")}
      density="tablet-tight"
      className="border-t border-border"
      selection={{
        isSelected: (order) => selectedIds.has(order.id),
        onToggle: (order, checked) => onToggle(order.id, checked),
        onToggleAll,
        headerLabel: t("table.selectAll"),
        rowLabel: (order) => t("table.selectRow", { id: order.id }),
      }}
      onRowClick={(order) => onToggle(order.id, !selectedIds.has(order.id))}
      renderCard={renderCard}
    />
  );
};
