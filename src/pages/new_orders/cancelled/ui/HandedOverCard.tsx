// dizayn-v2: superadmin-neworders-cancelled-handover-done
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import {
  OrderStatusBadge,
  useCancelHandoverMethodLabel,
  type CancelHandoverInfo,
} from "../../../../entities/order";
import type { OrderListItem } from "../../../../entities/order/types/order";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Card, DataTable, type DataTableColumn } from "../../../../shared/ui/primitives";

/** Shu sahifada topshirilgan buyurtma (sessiya ichida, backendsiz). */
export interface HandedOverOrder {
  order: OrderListItem;
  /** Topshirilgan vaqt (ms). */
  at: number;
  handover: CancelHandoverInfo;
}

/**
 * «TOPSHIRILDI (N)» — topshirishdan keyin qatorlar shunchaki yo'qolmaydi (taklif §3.3, maket
 * `superadmin-neworders-cancelled-handover-done`): Buyurtma · Mijoz · Holat («Marketga topshirildi» + joy va usul) ·
 * Vaqt · Summa; telefonda kartalar. Sahifa yangilansa ro'yxat tozalanadi — buyurtmalar «Marketga topshirildi»
 * holatida qoladi (izohda aytiladi).
 */
export const HandedOverCard = ({ rows }: { rows: readonly HandedOverOrder[] }) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const methodLabel = useCancelHandoverMethodLabel();
  const money = (value: unknown) => formatMoneyLocalized(value, { language });
  const total = rows.reduce((sum, row) => sum + (Number(row.order.total_price) || 0), 0);

  const placeLine = (row: HandedOverOrder) =>
    [row.order.branch?.name?.trim() || null, methodLabel(row.handover)].filter(Boolean).join(" · ");
  const districtOf = (row: HandedOverOrder) => row.order.district?.name?.trim() || null;

  // Qatorlar kam (sessiya ichida topshirilganlar) — ustunlar har chizishda quriladi.
  const columns: DataTableColumn<HandedOverOrder>[] = [
    {
      id: "order",
      header: t("cancelled.done.columns.order"),
      cell: (row) => (
        <Link
          to={`/orders/edit/${row.order.id}`}
          className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
        >
          №{row.order.id}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t("cancelled.done.columns.customer"),
      cell: (row) => (
        <>
          <div className="whitespace-nowrap font-semibold text-text">
            {row.order.customer?.name || "—"}
          </div>
          {districtOf(row) ? (
            <div className="text-[13px] text-text-muted">{districtOf(row)}</div>
          ) : null}
        </>
      ),
    },
    {
      id: "status",
      header: t("cancelled.done.columns.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <OrderStatusBadge status="returned_to_market" />
          <span className="text-[13px] text-text-muted">{placeLine(row)}</span>
        </div>
      ),
    },
    {
      id: "time",
      header: t("cancelled.done.columns.time"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => formatDateTimeLocalized(row.at, { language }),
    },
    {
      id: "amount",
      header: t("cancelled.done.columns.amount"),
      align: "end",
      cell: (row) => (
        <span className="whitespace-nowrap font-semibold text-text">
          {money(row.order.total_price)}
        </span>
      ),
    },
  ];

  const renderCard = (row: HandedOverOrder) => (
    <Link
      to={`/orders/edit/${row.order.id}`}
      className="flex min-w-0 flex-col gap-1 px-4 py-3 text-text"
    >
      <span className="flex min-w-0 justify-between gap-2">
        <span className="min-w-0 font-semibold">{row.order.customer?.name || "—"}</span>
        <span className="whitespace-nowrap font-semibold">{money(row.order.total_price)}</span>
      </span>
      <span className="text-[13px] text-text-muted">
        {[`№${row.order.id}`, districtOf(row)].filter(Boolean).join(" · ")}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status="returned_to_market" />
        <span className="ml-auto whitespace-nowrap text-xs text-text-muted">
          {formatDateTimeLocalized(row.at, { language })}
        </span>
      </span>
      <span className="text-[13px] text-text-muted">{placeLine(row)}</span>
    </Link>
  );

  const count = formatNumberLocalized(rows.length, { language });

  return (
    <Card
      as="section"
      padding="none"
      title={t("cancelled.done.title")}
      titleAddon={<Badge>{t("cancelled.done.count", { count: rows.length, value: count })}</Badge>}
      description={t("cancelled.done.hint")}
      actions={
        <p className="m-0 whitespace-nowrap text-[13px] text-text-muted">
          <Trans
            t={t}
            i18nKey="cancelled.done.total"
            values={{ sum: money(total) }}
            components={{ strong: <strong className="font-semibold text-text" /> }}
          />
        </p>
      }
      data-testid="handed-over-card"
    >
      <DataTable
        rows={[...rows]}
        columns={columns}
        getRowKey={(row) => String(row.order.id)}
        label={t("cancelled.done.label")}
        renderCard={renderCard}
        className="border-t border-border"
      />
    </Card>
  );
};
