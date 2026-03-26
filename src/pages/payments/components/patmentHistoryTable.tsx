import { memo, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, History } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateStr;
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentRow {
  id: string;
  amount: number;
  balance_after?: number;
  operation_type?: string;
  source_type?: string;
  source_id?: string;
  cashbox_type?: string;
  created_by?: string;
  payment_method?: string;
  payment_date?: string;
  comment?: string;
  createdAt?: string;
  created_at?: string;
  cashbox?: {
    id: string;
    balance: number;
    balance_cash?: number;
    balance_card?: number;
    cashbox_type: string;
  };
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaymentHistoryTableProps {
  data?: PaymentRow[];
  isLoading?: boolean;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  currentPage?: number;
}

// ─── PaymentHistoryTable ──────────────────────────────────────────────────────

const PaymentHistoryTable = ({
  data = [],
  isLoading = false,
  pagination,
  onPageChange,
  currentPage,
}: PaymentHistoryTableProps) => {
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);

  const activePage = pagination?.page ?? currentPage ?? 1;
  const hasPagination = pagination && pagination.totalPages > 1;
  const rowOffset = (activePage - 1) * (pagination?.limit ?? 10);

  const columns = useMemo<ColumnConfig<PaymentRow>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "52px",
        render: (_, __, i) => (
          <span className="text-sm font-bold text-main">
            {rowOffset + i + 1}
          </span>
        ),
      },
      {
        key: "created_by",
        label: "Created by",
        width: "200px",
        render: (val) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block max-w-45">
            {val || "-"}
          </span>
        ),
      },
      {
        key: "source_type",
        label: "Source type",
        width: "140px",
        render: (val) => (
          <span className="text-sm text-main/80 font-medium">{val || "-"}</span>
        ),
      },
      {
        key: "cashbox_type",
        label: "Cashbox type",
        width: "150px",
        render: (val, row) => {
          const type = val || row.cashbox?.cashbox_type;
          return (
            <span className="text-sm text-gray-700 dark:text-white/70">
              {type || "-"}
            </span>
          );
        },
      },
      {
        key: "operation_type",
        label: "Operation type",
        width: "160px",
        render: (val) => {
          const isIncome = val === "income";
          return (
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
                isIncome
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-rose-500/15 text-rose-400"
              }`}
            >
              {val ? (isIncome ? "Income" : "Expense") : "-"}
            </span>
          );
        },
      },
      {
        key: "amount",
        label: "Amount",
        width: "180px",
        render: (val, row) => {
          const isIncome = row.operation_type === "income";
          return (
            <span
              className={`text-sm font-bold whitespace-nowrap ${
                isIncome ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isIncome ? "+" : "-"}
              {fmt(Math.abs(val))} UZS
            </span>
          );
        },
      },
      {
        key: "payment_date",
        label: "Payment date",
        width: "210px",
        render: (val, row) => (
          <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <Calendar size={14} className="shrink-0" />
            {formatDate(
              (val || row.createdAt || row.created_at || "") as string,
            )}
          </span>
        ),
      },
    ],
    [rowOffset],
  );

  return (
    <>
      <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-glass-border">
          <div className="flex items-center gap-2">
            <History size={16} className="text-main" />
            <span className="text-sm font-bold text-gray-700 dark:text-white/70">
              history
            </span>
            {pagination && (
              <span className="text-xs text-gray-400 dark:text-white/40 ml-1">
                ·{" "}
                <span className="font-bold text-main">{pagination.total}</span>{" "}
                total
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <Table<PaymentRow>
          data={data}
          columns={columns}
          loading={isLoading}
          dense
          keyExtractor={(row) => row.id}
          emptyMessage="Finance tarixi topilmadi"
          onRowClick={(row) => setSelectedRow(row)}
        />

        {/* Pagination */}
        {hasPagination && onPageChange && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-glass-border">
            <span className="text-xs text-gray-500 dark:text-white/40">
              {activePage}-sahifa / {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(activePage - 1)}
                disabled={activePage <= 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - activePage) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`min-w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      p === activePage
                        ? "bg-main text-white shadow-sm shadow-main/30"
                        : "border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-main/10 hover:text-main"
                    }`}
                  >
                    {p}
                  </button>
                ))}

              <button
                onClick={() => onPageChange(activePage + 1)}
                disabled={activePage >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail popup */}
      <FinanceHistoryDetailPopup
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );
};

export default memo(PaymentHistoryTable);
