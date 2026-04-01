import { memo, useMemo } from "react";
import { Table } from "../../../../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../../../../shared/components/Table/Table.types";
import { User, XCircle } from "lucide-react";
import type { Order } from "./pendingOrderTable";

type Props = {
  orders: Order[];
  loading?: boolean;
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
};

const CancelledOrdersTable = ({
  orders,
  loading,
  selectedIds,
  onSelectChange,
  onSelectAll,
}: Props) => {
  const allChecked = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someChecked = orders.some((o) => selectedIds.has(o.id));

  const renderSelectAllCheckbox = () => (
    <input
      type="checkbox"
      checked={allChecked}
      ref={(el) => {
        if (el) el.indeterminate = someChecked && !allChecked;
      }}
      onChange={(e) => onSelectAll(e.target.checked)}
      className="h-4 w-4 cursor-pointer accent-red-500"
    />
  );

  const columns: ColumnConfig<Order>[] = useMemo(
    () => [
      {
        key: "id",
        label: "Tanlash",
        renderHeader: () => renderSelectAllCheckbox(),
        width: "40px",
        render: (_, row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={(e) => {
              e.stopPropagation();
              onSelectChange(row.id, e.target.checked);
            }}
            className="w-4 h-4 accent-red-500 cursor-pointer"
          />
        ),
      },
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
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
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
        render: (_, row) => <span className="text-sm">{row.district?.name ?? "—"}</span>,
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
        render: () => (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <XCircle size={13} />
            bekor qilingan
          </span>
        ),
      },
      {
        key: "total_price",
        label: "Narx",
        sortable: true,
        render: (val) => (
          <span className="font-bold text-sm">
            {Number(val).toLocaleString("uz-UZ")} so'm
          </span>
        ),
      },
      {
        key: "where_deliver",
        label: "Qayergacha",
        render: (val) => (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              val === "center"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
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
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
        ),
      },
    ],
    [selectedIds, allChecked, someChecked, onSelectChange, onSelectAll]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-2xl border border-[color:var(--color-border-soft)] bg-primary px-4 py-3 dark:border-primarydark/60 dark:bg-maindark xl:hidden">
        <span className="text-sm font-semibold text-maindark dark:text-primary">
          Hammasini belgilash
        </span>
        {renderSelectAllCheckbox()}
      </div>

      <Table
        data={orders}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="Bekor qilingan buyurtmalar mavjud emas"
      />
    </div>
  );
};

export default memo(CancelledOrdersTable);
