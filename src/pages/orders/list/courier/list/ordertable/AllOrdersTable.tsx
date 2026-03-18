import { memo, useMemo } from "react";
import { Table } from "../../../../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../../../../shared/components/Table/Table.types";
import {
  User, Clock, Hourglass, BadgeCheck, XCircle, Truck,
  PackageCheck, Sparkles, CircleDollarSign, CheckCircle2, RotateCcw,
} from "lucide-react";
import type { Order } from "./pendingOrderTable";

const statusConfig = {
  created:            { icon: <Clock size={13} />,            className: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300" },
  new:                { icon: <Sparkles size={13} />,         className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  received:           { icon: <PackageCheck size={13} />,     className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  "on the road":      { icon: <Truck size={13} />,            className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  waiting:            { icon: <Hourglass size={13} />,        className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  sold:               { icon: <BadgeCheck size={13} />,       className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  cancelled:          { icon: <XCircle size={13} />,          className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  paid:               { icon: <CircleDollarSign size={13} />, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  partly_paid:        { icon: <CircleDollarSign size={13} />, className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  "cancelled (sent)": { icon: <XCircle size={13} />,          className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  closed:             { icon: <CheckCircle2 size={13} />,     className: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300" },
} as const;

const fallbackStatus = {
  icon: <Clock size={13} />,
  className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

// Sotish + Bekor tugmalari ko'rsatiladigan statuslar
const ACTIVE_STATUSES = ["waiting", "on the road", "new", "received"];

// Rollback ko'rsatiladigan statuslar — faqat sold va cancelled
const ROLLBACK_STATUSES = ["sold", "cancelled"];

const renderHarakat = (
  row: Order,
  onDeliver?: (o: Order) => void,
  onCancel?: (o: Order) => void,
  onRestore?: (o: Order) => void,
) => {
  // Sotish + Bekor
  if (ACTIVE_STATUSES.includes(row.status)) {
    return (
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
    );
  }

  // Faqat sold va cancelled — Rollback tugmasi
  if (ROLLBACK_STATUSES.includes(row.status)) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onRestore?.(row); }}
        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Qayta tiklash"
      >
        <RotateCcw size={15} />
      </button>
    );
  }

  // Qolgan barcha statuslar (cancelled (sent), paid, partly_paid, closed, created...) — bo'sh
  return null;
};

type Props = {
  orders: Order[];
  loading?: boolean;
  onDeliver?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onRestore?: (order: Order) => void;
};

const AllOrdersTable = ({ orders, loading, onDeliver, onCancel, onRestore }: Props) => {
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
          <span className="text-sm">{row.district?.name ?? "—"}</span>
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
          const key = val as string;
          const cfg =
            (statusConfig as Record<string, { icon: React.ReactNode; className: string }>)[key]
            ?? fallbackStatus;
          return (
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit ${cfg.className}`}>
              {cfg.icon}
              {key}
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
        render: (_, row) => renderHarakat(row, onDeliver, onCancel, onRestore),
      },
    ],
    [onDeliver, onCancel, onRestore]
  );

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

export default memo(AllOrdersTable);