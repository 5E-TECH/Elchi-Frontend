import { memo } from 'react';
import { Package, Calendar, Tag, Truck, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../types/user';
import { Table } from '../../../shared/components/Table/Table';
import type { ColumnConfig } from '../../../shared/components/Table/Table.types';
import { useTranslation } from 'react-i18next';

interface CustomerOrdersTableProps {
    orders: Order[];
}

const formatMoney = (n: number) =>
    n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";

const formatDate = (d: string) => {
    try {
        return new Date(d).toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch { return d; }
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: 'Yangi', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    pending: { label: 'Kutilmoqda', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    delivered: { label: 'Yetkazildi', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    canceled: { label: 'Bekor qilindi', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
};

export const CustomerOrdersTable = memo(({ orders }: CustomerOrdersTableProps) => {
    const { t } = useTranslation("users");
    const navigate = useNavigate();

    const columns: ColumnConfig<Order>[] = [
        {
            key: 'id',
            label: t('idDate'),
            width: '25%',
            render: (_, order) => (
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Tag size={13} className="text-main" />
                        #{order.id}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-white/40 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} />
                        {formatDate(order.createdAt)}
                    </span>
                </div>
            )
        },
        {
            key: 'product_quantity',
            label: t('products'),
            width: '20%',
            render: (val) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                        <Package size={14} className="text-slate-500 dark:text-white/40" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-white">
                        {t("productCount", { count: val })}
                    </span>
                </div>
            )
        },
        {
            key: 'where_deliver',
            label: t('address'),
            width: '20%',
            render: (val) => (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 w-fit">
                    <Truck size={13} className="text-slate-500 dark:text-white/40" />
                    <span className="text-[11px] font-bold text-slate-600 dark:text-white/60">
                        {val === 'center' ? t('centerOnlyTariff') : t('doorTariff')}
                    </span>
                </div>
            )
        },
        {
            key: 'total_price',
            label: t('totalAmount'),
            width: '20%',
            render: (val) => (
                <span className="text-sm font-black text-main tabular-nums">
                    {formatMoney(Number(val))}
                </span>
            )
        },
        {
            key: 'status',
            label: t('status'),
            width: '15%',
            render: (val) => {
                const config = STATUS_MAP[String(val)] ?? STATUS_MAP.new;
                return (
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${config.bg} ${config.color} border border-current/10`}>
                        {config.label}
                    </span>
                );
            }
        }
    ];

    return (
        <div className="bg-white dark:bg-maindark rounded-2xl border border-slate-100 dark:border-primarydark/20 shadow-sm overflow-hidden mt-5">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 bg-main rounded-full" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-white">
                        {t("userHistory")}
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-main/5 border border-main/10">
                    <Info size={12} className="text-main" />
                    <span className="text-[10px] font-bold text-main uppercase tracking-widest">
                        {t("totalLabel")}: {orders.length}
                    </span>
                </div>
            </div>

            {/* Table */}
            {orders.length > 0 ? (
                <Table
                    data={orders}
                    columns={columns}
                    keyExtractor={(o) => o.id}
                    hoverable
                    onRowClick={(order) => navigate(`/new-orders/${order.market_id}/edit/${order.id}`)}
                />
            ) : (
                <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-slate-300 dark:text-white/10" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 dark:text-white/20 uppercase tracking-widest">
                        {t("ordersNotFound")}
                    </p>
                </div>
            )}
        </div>
    );
});

CustomerOrdersTable.displayName = 'CustomerOrdersTable';
