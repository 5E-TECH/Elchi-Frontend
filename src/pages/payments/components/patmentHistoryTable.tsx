import { memo, useMemo, useState } from "react";
import { Calendar, History } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import { useTranslation } from "react-i18next";
import Pagination from "../../../shared/components/pagination";

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
  const { t } = useTranslation("payments");
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);

  const activePage = pagination?.page ?? currentPage ?? 1;
  const safeLimit = pagination?.limit ?? 20;
  const safeTotal = pagination?.total ?? data.length;
  const totalPages =
    pagination?.totalPages ?? Math.max(1, Math.ceil(safeTotal / safeLimit));
  const hasPagination = Boolean(pagination && onPageChange);
  const rowOffset = (activePage - 1) * safeLimit;

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
        label: t("createdBy"),
        width: "200px",
        render: (val) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block max-w-45">
            {val || "-"}
          </span>
        ),
      },
      {
        key: "source_type",
        label: t("sourceType"),
        width: "140px",
        render: (val) => (
          <span className="text-sm text-main/80 font-medium">{val || "-"}</span>
        ),
      },
      {
        key: "cashbox_type",
        label: t("cashboxType"),
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
        label: t("operationType"),
        width: "160px",
        render: (val) => {
          const isIncome = val === "income";
          return (
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${isIncome
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
                }`}
            >
              {val ? (isIncome ? t("income") : t("expense")) : "-"}
            </span>
          );
        },
      },
      {
        key: "amount",
        label: t("amount"),
        width: "180px",
        render: (val, row) => {
          const isIncome = row.operation_type === "income";
          return (
            <span
              className={`text-sm font-bold whitespace-nowrap ${isIncome ? "text-emerald-400" : "text-rose-400"
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
        label: t("paymentDate"),
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
    [rowOffset, t],
  );

  return (
    <>
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-glass-border">
          <div className="flex items-center gap-2">
            <History size={16} className="text-main" />
            <span className="text-sm font-bold text-gray-700 dark:text-white/70">
              {t("historyLower")}
            </span>
            {pagination && (
              <span className="text-xs text-gray-400 dark:text-white/40 ml-1">
                ·{" "}
                <span className="font-bold text-main">{pagination.total}</span>{" "}
                {t("total")}
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
          emptyMessage={t("financeHistoryNotFound")}
          onRowClick={(row) => setSelectedRow(row)}
        />

        {/* Pagination */}
        {hasPagination && onPageChange && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-glass-border">
            <span className="text-xs text-gray-500 dark:text-white/40">
              {t("pageLabel", { page: activePage, totalPages })}
            </span>
            <Pagination
              totalItems={safeTotal}
              itemsPerPage={safeLimit}
              currentPage={activePage}
              onPageChange={onPageChange}
              className="w-full pt-0 sm:w-auto"
              summary={null}
            />
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
