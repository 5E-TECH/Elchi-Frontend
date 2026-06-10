import { memo, useMemo, useState } from "react";
import { Banknote, Calendar, History, UserRound } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import { useTranslation } from "react-i18next";
import Pagination from "../../../shared/components/pagination";
import { resolvePaymentActorName } from "./paymentHistoryActor";
import { getPaymentSourceTypeLabel } from "./paymentSourceType";

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
  created_by_user?: PaymentHistoryActor | null;
  createdByUser?: PaymentHistoryActor | null;
  user?: PaymentHistoryActor | null;
  source_user?: PaymentHistoryActor | null;
  sourceUser?: PaymentHistoryActor | null;
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

export interface PaymentHistoryActor {
  id?: string | number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
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
  onItemsPerPageChange?: (limit: number) => void;
  currentPage?: number;
}

// ─── PaymentHistoryTable ──────────────────────────────────────────────────────

const PaymentHistoryTable = ({
  data = [],
  isLoading = false,
  pagination,
  onPageChange,
  onItemsPerPageChange,
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
        render: (_, row) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate block max-w-45">
            {resolvePaymentActorName(row)}
          </span>
        ),
      },
      {
        key: "source_type",
        label: t("sourceType"),
        width: "140px",
        render: (val) => (
          <span className="text-sm text-main/80 font-medium">
            {getPaymentSourceTypeLabel(val as string | undefined, t)}
          </span>
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
          mobileRowRender={(row, index) => {
            const isIncome = row.operation_type === "income";
            const rowNumber = rowOffset + index + 1;
            const paymentDate = formatDate(
              (row.payment_date || row.createdAt || row.created_at || "") as string,
            );
            const sourceLabel = row.source_type || "-";
            const cashboxLabel = row.cashbox_type || row.cashbox?.cashbox_type || "-";

            return (
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-main/15 bg-main/10 text-main shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white">
                    <UserRound size={16} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {resolvePaymentActorName(row)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-slate-500 dark:text-white/65">
                      <Calendar size={13} />
                      <span className="truncate">{paymentDate}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/60">
                      <span>{sourceLabel}</span>
                      <span>•</span>
                      <span>{cashboxLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs font-semibold text-main">#{rowNumber}</span>
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${isIncome ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}
                  >
                    {row.operation_type ? (isIncome ? t("income") : t("expense")) : "-"}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-sm font-bold ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                    <Banknote size={13} />
                    {isIncome ? "+" : "-"}{fmt(Math.abs(row.amount))} UZS
                  </span>
                </div>
              </div>
            );
          }}
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
              onItemsPerPageChange={onItemsPerPageChange}
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
