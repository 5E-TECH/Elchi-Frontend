import { memo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Table } from '../../../shared/components/Table/Table';
import type { ColumnConfig } from '../../../shared/components/Table/Table.types';

const fmt = (n: number) => n.toLocaleString('uz-UZ');

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// API dan kelayotgan actual field nomlari
export interface PaymentRow {
  id: string;
  amount: number;
  operation_type?: { id: string | number; name: string } | string;
  source_type?: { id: string | number; name: string } | string;
  cashbox_type?: { id: string | number; name: string } | string;
  created_by?: { id: string; name: string; role?: string } | string;
  cashbox?: { id: string; name: string } | string;
  comment?: string;
  created_at: string;
  updated_at?: string;
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

// Nested object yoki string bo'lishi mumkin bo'lgan fielddan nom olish
const getName = (val: any): string => {
  if (!val) return '-';
  if (typeof val === 'object' && val.name) return val.name;
  return String(val);
};

const COLUMNS: ColumnConfig<PaymentRow>[] = [
  {
    key: 'id',
    label: '#',
    width: '60px',
    render: (_, __, i) => <span className="font-bold text-main">{i + 1}</span>,
  },
  {
    key: 'created_by',
    label: 'Created by',
    render: (_, row) => {
      const user = row.created_by;
      if (!user) return <span className="text-gray-400">-</span>;
      if (typeof user === 'object') {
        return (
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
            {user.role && (
              <p className="text-xs text-main mt-0.5 capitalize">{user.role}</p>
            )}
          </div>
        );
      }
      return <span className="font-semibold text-gray-900 dark:text-white">{user}</span>;
    },
  },
  {
    key: 'source_type',
    label: 'Source type',
    render: (_, row) => (
      <span className="text-gray-600 dark:text-gray-300">{getName(row.source_type)}</span>
    ),
  },
  {
    key: 'operation_type',
    label: 'Operation type',
    render: (_, row) => (
      <span className="px-2.5 py-1 rounded-lg bg-main/15 text-main text-xs font-semibold">
        {getName(row.operation_type)}
      </span>
    ),
  },
  {
    key: 'cashbox',
    label: 'Cashbox',
    render: (_, row) => (
      <span className="text-gray-500 dark:text-gray-400 text-sm">{getName(row.cashbox)}</span>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (val) => (
      <span className={`font-bold text-sm ${val < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
        {val > 0 ? '+' : ''}{fmt(val)} UZS
      </span>
    ),
  },
  {
    key: 'created_at',
    label: 'Date',
    render: (val) => (
      <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
        <Calendar size={13} />
        {formatDate(val)}
      </span>
    ),
  },
];

const PaymentHistoryTable = ({
  data = [],
  isLoading = false,
  pagination,
  onPageChange,
  currentPage,
}: PaymentHistoryTableProps) => {
  const activePage = pagination?.page ?? currentPage ?? 1;
  const hasPagination = pagination && pagination.totalPages > 1;

  return (
    <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-glass-border">
        <div className="flex items-center gap-2">
          <History size={16} className="text-main" />
          <span className="text-sm font-bold text-gray-700 dark:text-white/70">Finance History</span>
        </div>
        {pagination && (
          <span className="text-xs text-gray-400 dark:text-white/40">
            Total: <span className="font-bold text-main">{pagination.total}</span>
          </span>
        )}
      </div>

      {/* Table */}
      <Table<PaymentRow>
        data={data}
        columns={COLUMNS}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Finance tarixi topilmadi"
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
                  className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition-colors ${p === activePage
                      ? 'bg-main text-white shadow-sm shadow-main/30'
                      : 'border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-main/10 hover:text-main'
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
  );
};

export default memo(PaymentHistoryTable);