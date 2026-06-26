import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "../../../../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../../../../shared/components/Table/Table.types";
import { Calendar, MapPin, Phone, Store, User } from "lucide-react";
import OrderStatusBadge from "../../../OrderStatusBadge";

export const Order_status = {
  CREATED: 'created', NEW: 'new', RECEIVED: 'received',
  ON_THE_ROAD: 'on the road', WAITING: 'waiting', SOLD: 'sold',
  CANCELLED: 'cancelled', PAID: 'paid', PARTLY_PAID: 'partly_paid',
  CANCELLED_SENT: 'cancelled (sent)', CLOSED: 'closed',
} as const;
export type Order_status = typeof Order_status[keyof typeof Order_status];

type OrderItem = { id: string; quantity: number; product: { name: string; image_url: string | null } };
export type Order = {
  id: string; created_at: string; status: string; total_price: number;
  where_deliver: string; product_quantity: number;
  market: { name: string; expense_proof_conditions?: string[] | null }; customer: { name: string; phone_number: string };
  district: { name: string }; region: { name: string }; items: OrderItem[];
  sell_requires_media?: boolean; cancel_requires_media?: boolean;
};

type Props = {
  orders: Order[];
  loading?: boolean;
  onRowClick?: (order: Order) => void;
  onDeliver?: (order: Order) => void;
  onCancel?: (order: Order) => void;
};

const PendingOrdersTable = ({ orders, loading, onRowClick, onDeliver, onCancel }: Props) => {
  const { t } = useTranslation("orders");
  const formatDate = (value: string) =>
    new Date(value).toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const columns: ColumnConfig<Order>[] = useMemo(() => [
    {
      key: "id", label: "#", width: "50px",
      render: (_, __, rowIndex) => (
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{(rowIndex ?? 0) + 1}</span>
      ),
    },
    {
      key: "customer", label: t("customer"),
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
            <User size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm">{row.customer?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "customer", label: t("phone"),
      render: (_, row) => <span className="text-sm text-gray-600 dark:text-gray-300">{row.customer?.phone_number ?? "—"}</span>,
    },
    {
      key: "district", label: t("location"),
      render: (_, row) => <span className="text-sm">{row.district?.name ?? "—"}</span>,
    },
    {
      key: "market", label: t("market"),
      render: (_, row) => <span className="text-sm font-medium">{row.market?.name ?? "—"}</span>,
    },
    {
      key: "status", label: t("orderStatus"),
      render: (val) => <OrderStatusBadge status={(val === Order_status.CANCELLED_SENT ? Order_status.CANCELLED : val) as Exclude<Order_status, "cancelled (sent)">} />,
    },
    {
      key: "total_price", label: t("price"), sortable: true,
      render: (val) => <span className="font-bold text-sm">{Number(val).toLocaleString("uz-UZ")}</span>,
    },
    {
      key: "where_deliver", label: t("deliveryWhere"),
      render: (val) => <span className="text-sm">{val === "center" ? t("deliveryToCenter") : t("deliveryToHome")}</span>,
    },
    {
      key: "created_at", label: t("date"), sortable: true,
      render: (val) => (
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {new Date(val as string).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      key: "id", label: t("action"),
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onDeliver?.(row); }}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors">
            {t("sell")}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onCancel?.(row); }}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors">
            {t("cancelOrderAction")}
          </button>
        </div>
      ),
    },
  ], [onDeliver, onCancel, t]);

  return (
    <Table
      data={orders}
      columns={columns}
      keyExtractor={(row) => row.id}
      loading={loading}
      emptyMessage={t("orderEmpty")}
      onRowClick={onRowClick}
      mobileRowRender={(row) => (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-bold text-slate-900 dark:text-white">{row.customer?.name ?? "—"}</p>
              <p className="m-0 mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-white/70">
                <Phone size={12} className="shrink-0" />
                <span className="truncate">{row.customer?.phone_number ?? "—"}</span>
              </p>
            </div>
            <OrderStatusBadge
              status={(row.status === Order_status.CANCELLED_SENT ? Order_status.CANCELLED : row.status) as Exclude<Order_status, "cancelled (sent)">}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-white/85">
              <Store size={11} className="shrink-0" />
              <span className="truncate">{row.market?.name ?? "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-white/85">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{row.district?.name ?? "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-white/85">
              {row.where_deliver === "center" ? t("deliveryToCenter") : t("deliveryToHome")}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {Number(row.total_price).toLocaleString("uz-UZ")}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-white/65">
              <Calendar size={11} className="shrink-0" />
              {formatDate(row.created_at)}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeliver?.(row);
              }}
              className="rounded-md bg-green-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-600"
            >
              {t("sell")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel?.(row);
              }}
              className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-600"
            >
              {t("cancelOrderAction")}
            </button>
          </div>
        </div>
      )}
    />
  );
};

export default memo(PendingOrdersTable);
