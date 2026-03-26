import { memo } from "react";
import { ShoppingBag } from "lucide-react";
import type { PostOrder } from "../../../../entities/mails";
import Checkbox from "./Checkbox";
import OrderRow from "./OrderRow";

interface OrdersTableProps {
    orders: PostOrder[];
    selectedIds: Set<string>;
    allSelected: boolean;
    someSelected: boolean;
    onToggleAll: () => void;
    onToggleOne: (id: string) => void;
    variant?: "default" | "history";
    readOnly?: boolean;
}

// ─── Ustun kengliklarini bir joyda boshqarish (header va row mos kelishi uchun)
export const TABLE_COLS =
    "grid-cols-[20px_minmax(160px,1.3fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(150px,1fr)_minmax(140px,1fr)]";
export const TABLE_COLS = "grid-cols-[20px_repeat(8,1fr)_28px]";
export const HISTORY_TABLE_COLS =
    "grid-cols-[minmax(170px,1.2fr)_minmax(170px,1.1fr)_minmax(190px,1.2fr)_minmax(130px,0.9fr)_minmax(140px,0.95fr)_minmax(150px,1fr)_minmax(135px,0.9fr)]";

// ─── Bo'sh holat ─────────────────────────────────────────────────────────────
const EmptyState = memo(() => (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-main/10 flex items-center justify-center">
            <ShoppingBag size={32} className="text-main" />
        </div>
        <div className="text-center">
            <p className="text-gray-700 dark:text-white font-semibold">
                Buyurtmalar topilmadi
            </p>
            <p className="text-gray-400 dark:text-white/60 text-sm mt-1">
                Bu pochta uchun hech qanday buyurtma yo'q
            </p>
        </div>
    </div>
));
EmptyState.displayName = "EmptyState";

// ─── Ustun sarlavhalar ────────────────────────────────────────────────────────
const TableHeader = memo(() => (
    <div className={`hidden lg:grid ${TABLE_COLS} items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2`}>
        <div />
        <div className="text-[11px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">Ism</div>
        <div className="text-[11px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">Telefon</div>
        <div className="text-[11px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">Tuman</div>
        <div className="text-[11px] text-black dark:text-white font-semibold uppercase tracking-wider">Market</div>
        <div className="text-[11px] text-black dark:text-white font-semibold uppercase tracking-wider">Narx</div>
        <div className="text-[11px] text-black dark:text-white font-semibold uppercase tracking-wider">Yetkazish</div>
        <div className="text-[11px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">Sana</div>
        <div className="text-[11px] text-black dark:text-white font-semibold uppercase tracking-wider text-right">Holati</div>
    </div>
));
TableHeader.displayName = "TableHeader";

const HistoryTableHeader = memo(() => (
    <div className={`hidden xl:grid ${HISTORY_TABLE_COLS} items-center gap-4 px-6 py-1`}>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Mijoz</div>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Telefon</div>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Manzil</div>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Market</div>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Narx</div>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Yetkazish</div>
        <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">Sana</div>
    </div>
));
HistoryTableHeader.displayName = "HistoryTableHeader";

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
const OrdersTable = memo(({
    orders,
    selectedIds,
    allSelected,
    someSelected,
    onToggleAll,
    onToggleOne,
    variant = "default",
    readOnly = false,
}: OrdersTableProps) => {
    if (orders.length === 0) return <EmptyState />;

    const isHistory = variant === "history";

    return (
        <div className="flex flex-col gap-2.5">
            {!isHistory && !readOnly && (
                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-primarydark border border-gray-100 dark:border-white/10 cursor-pointer"
                    onClick={onToggleAll}
                >
                    <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={onToggleAll}
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-white select-none">
                        Barchasini tanlash
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="ml-auto text-xs text-main dark:text-white font-semibold">
                            {selectedIds.size} ta tanlandi
                        </span>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <div className="min-w-[980px] lg:min-w-[1120px] flex flex-col gap-1.5">
                    {/* Ustun sarlavhalar */}
                    <TableHeader />
                <div className={`${isHistory ? "min-w-[1120px]" : "min-w-225"} flex flex-col gap-1.5`}>
                    {isHistory ? <HistoryTableHeader /> : <TableHeader />}

                    {orders.map((order) => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            checked={selectedIds.has(order.id)}
                            onToggle={onToggleOne}
                            variant={variant}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});
OrdersTable.displayName = "OrdersTable";

export default OrdersTable;
