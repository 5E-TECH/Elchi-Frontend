import { memo } from 'react';
import { Calendar } from 'lucide-react';
import { Table } from '../../../shared/components/Table/Table';
import type { ColumnConfig } from '../../../shared/components/Table/Table.types';

const fmt = (n: number) => n.toLocaleString('uz-UZ');

interface PaymentRow {
  id: string;
  created_by: string;
  role: string;
  cashbox_type: string;
  operation_type: string;
  amount: number;
  payment_date: string;
}

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
    render: (_, row) => (
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{row.created_by}</p>
        <p className="text-xs text-main mt-0.5">{row.role}</p>
      </div>
    ),
  },
  {
    key: 'cashbox_type',
    label: 'Cashbox type',
    render: (val) => <span className="text-gray-600 dark:text-gray-300">{val}</span>,
  },
  {
    key: 'operation_type',
    label: 'Operation type',
    render: (val) => (
      <span className="px-2.5 py-0.5 rounded-lg bg-main/15 text-main text-xs font-semibold">{val}</span>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (val) => (
      <span className={`font-bold ${val < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
        {val > 0 ? '+' : ''}{fmt(val)} UZS
      </span>
    ),
  },
  {
    key: 'payment_date',
    label: 'Payment date',
    render: (val) => (
      <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <Calendar size={13} />
        {val}
      </span>
    ),
  },
];

const PaymentHistoryTable = ({ data = [], isLoading = false }: { data?: PaymentRow[]; isLoading?: boolean }) => (
  <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
    <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-glass-border">
      <Calendar size={16} className="text-main" />
      <span className="text-sm font-bold text-gray-700 dark:text-white/70">history</span>
    </div>
    <Table<PaymentRow>
      data={data}
      columns={COLUMNS}
      loading={isLoading}
      keyExtractor={(_, i) => i}
      emptyMessage="To'lov tarixi topilmadi"
    />
  </div>
);

export default memo(PaymentHistoryTable);