import { memo, useMemo, type JSX } from "react";
import { Table } from "../../../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../../../shared/components/Table/Table.types";
import {
  BadgeCheck, Clock, XCircle, User,
  Truck, PackageCheck, Hourglass,
  Sparkles, CircleDollarSign, CheckCircle2,
} from "lucide-react";

export const Order_status = {
  CREATED: 'created',
  NEW: 'new',
  RECEIVED: 'received',
  ON_THE_ROAD: 'on the road',
  WAITING: 'waiting',
  SOLD: 'sold',
  CANCELLED: 'cancelled',
  PAID: 'paid',
  PARTLY_PAID: 'partly_paid',
  CANCELLED_SENT: 'cancelled (sent)',
  CLOSED: 'closed',
} as const;

export type Order_status = typeof Order_status[keyof typeof Order_status];

type OrderItem = {
  id: string;
  quantity: number;
  product: { name: string; image_url: string | null };
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  where_deliver: string;
  product_quantity: number;
  market: { name: string };
  customer: { name: string; phone_number: string };
  district: { name: string };
  region: { name: string };
  items: OrderItem[];
};

type OrdersTableProps = {
  orders: Order[];
  loading?: boolean;
  onRowClick?: (order: Order) => void;
  onDeliver?: (order: Order) => void;
  onCancel?: (order: Order) => void;
};

const statusConfig: Record<Order_status, { icon: JSX.Element; className: string }> = {
  [Order_status.CREATED]: {
    icon: <Clock size={13} />,
    className: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300",
  },
  [Order_status.NEW]: {
    icon: <Sparkles size={13} />,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  [Order_status.RECEIVED]: {
    icon: <PackageCheck size={13} />,
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  [Order_status.ON_THE_ROAD]: {
    icon: <Truck size={13} />,
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  [Order_status.WAITING]: {
    icon: <Hourglass size={13} />,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  [Order_status.SOLD]: {
    icon: <BadgeCheck size={13} />,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  [Order_status.CANCELLED]: {
    icon: <XCircle size={13} />,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  [Order_status.PAID]: {
    icon: <CircleDollarSign size={13} />,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  [Order_status.PARTLY_PAID]: {
    icon: <CircleDollarSign size={13} />,
    className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  [Order_status.CANCELLED_SENT]: {
    icon: <XCircle size={13} />,
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
  [Order_status.CLOSED]: {
    icon: <CheckCircle2 size={13} />,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
  },
};

const fallbackStatus = {
  icon: <Clock size={13} />,
  className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const OrdersTable = ({ orders, loading, onDeliver, onCancel }: OrdersTableProps) => {
  const columns: ColumnConfig<Order>[] = useMemo(
    () => [
      {
        key: "id",
        label: "#",
        width: "50px",
        render: (_, __, rowIndex) => (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {(rowIndex ?? 0) + 1}
          </span>
        ),
      },
      {
        key: "customer",
        label: "Mijoz",
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
        key: "customer",
        label: "Telefon",
        render: (_, row) => (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {row.customer?.phone_number ?? "—"}
          </span>
        ),
      },
      {
        key: "district",
        label: "Manzili",
        render: (_, row) => (
          <span className="text-sm">
            {row.district?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "market",
        label: "Market",
        render: (_, row) => (
          <span className="text-sm font-medium">{row.market?.name ?? "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Holat",
        render: (val) => {
          const cfg = statusConfig[val as Order_status] ?? fallbackStatus;
          return (
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit ${cfg.className}`}>
              {cfg.icon}
              {val as string}
            </span>
          );
        },
      },
      {
        key: "total_price",
        label: "Narx",
        sortable: true,
        render: (val) => (
          <span className="font-bold text-sm">
            {Number(val).toLocaleString("uz-UZ")}
          </span>
        ),
      },
      {
        key: "where_deliver",
        label: "Qayergacha",
        render: (val) => (
          <span className="text-sm">
            {val === "center" ? "Markazgacha" : "Uygacha"}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Sana",
        sortable: true,
        render: (val) => (
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {new Date(val as string).toLocaleString("uz-UZ", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        key: "id",
        label: "Harakat",
        render: (_, row) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onDeliver?.(row); }}
              className="px-3 py-1 text-xs font-semibold rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors"
            >
              Sotish
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCancel?.(row); }}
              className="px-3 py-1 text-xs font-semibold rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              Bekor
            </button>
          </div>
        ),
      },
    ],
    [onDeliver, onCancel]
  );
  console.log(orders);
  

  return (
    <Table
      data={orders}
      columns={columns}
      keyExtractor={(row) => row.id}
      loading={loading}
      emptyMessage="Buyurtmalar mavjud emas"
    />
  );
};

export default memo(OrdersTable);