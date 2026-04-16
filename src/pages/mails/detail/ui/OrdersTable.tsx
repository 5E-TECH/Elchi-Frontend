import { memo } from "react";
import { ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
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
    onPrintOne?: (order: PostOrder, mode: "browser" | "pdf_100x60" | "thermal_80mm") => void;
    onDeleteOne?: (orderId: string) => void;
    canDelete?: boolean;
    variant?: "default" | "history";
    readOnly?: boolean;
}

// ─── Ustun kengliklarini bir joyda boshqarish (header va row mos kelishi uchun)
export const TABLE_COLS =
    "grid-cols-[20px_minmax(150px,1.18fr)_minmax(132px,0.92fr)_minmax(132px,0.9fr)_minmax(128px,0.88fr)_minmax(108px,0.74fr)_minmax(128px,0.82fr)_minmax(132px,0.84fr)_minmax(118px,0.76fr)_76px]";
export const HISTORY_TABLE_COLS =
    "grid-cols-[minmax(170px,1.2fr)_minmax(170px,1.1fr)_minmax(190px,1.2fr)_minmax(130px,0.9fr)_minmax(140px,0.95fr)_minmax(150px,1fr)_minmax(135px,0.9fr)]";

// ─── Bo'sh holat ─────────────────────────────────────────────────────────────
const EmptyState = memo(() => {
    const { t } = useTranslation("mails");

    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-main/10 flex items-center justify-center">
                <ShoppingBag size={32} className="text-main" />
            </div>
            <div className="text-center">
                <p className="text-gray-700 dark:text-white font-semibold">
                    {t("emptyOrders")}
                </p>
                <p className="text-gray-400 dark:text-white/60 text-sm mt-1">
                    {t("emptyOrdersHint")}
                </p>
            </div>
        </div>
    );
});
EmptyState.displayName = "EmptyState";

// ─── Ustun sarlavhalar ────────────────────────────────────────────────────────
const TableHeader = memo(() => {
    const { t } = useTranslation(["orders", "common"]);

    return (
        <div className={`hidden xl:grid ${TABLE_COLS} items-center gap-2 px-3 xl:px-4 py-2`}>
            <div />
            <div className="text-[12px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">{t("orders:customerName")}</div>
            <div className="text-[12px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">{t("common:phone")}</div>
            <div className="text-[12px] pl-8 text-black dark:text-white font-semibold uppercase tracking-wider">{t("common:district")}</div>
            <div className="text-[12px] text-black dark:text-white font-semibold uppercase tracking-wider">{t("orders:market")}</div>
            <div className="text-[12px] text-black dark:text-white font-semibold uppercase tracking-wider">{t("common:price")}</div>
            <div className="text-[12px] text-black dark:text-white font-semibold uppercase tracking-wider">{t("orders:deliveryType")}</div>
            <div className="text-[12px] pl-4 text-black dark:text-white font-semibold uppercase tracking-wider">{t("common:date")}</div>
            <div className="text-[12px] text-black dark:text-white font-semibold uppercase tracking-wider text-center">{t("orders:orderStatus")}</div>
            <div className="text-[12px] text-black dark:text-white font-semibold uppercase tracking-wider text-center">{t("common:actions")}</div>
        </div>
    );
});
TableHeader.displayName = "TableHeader";

const HistoryTableHeader = memo(() => {
    const { t } = useTranslation(["orders", "common"]);

    return (
        <div className={`hidden xl:grid ${HISTORY_TABLE_COLS} items-center gap-4 px-6 py-1`}>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("orders:customer")}</div>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("common:phone")}</div>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("common:address")}</div>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("orders:market")}</div>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("common:price")}</div>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("orders:deliveryType")}</div>
            <div className="text-[11px] text-slate-500 dark:text-white/70 font-semibold uppercase tracking-wider">{t("common:date")}</div>
        </div>
    );
});
HistoryTableHeader.displayName = "HistoryTableHeader";

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
const OrdersTable = memo(({
    orders,
    selectedIds,
    allSelected,
    someSelected,
    onToggleAll,
    onToggleOne,
    onPrintOne,
    onDeleteOne,
    canDelete = false,
    variant = "default",
    readOnly = false,
}: OrdersTableProps) => {
    const { t } = useTranslation("mails");

    if (orders.length === 0) return <EmptyState />;

    const isHistory = variant === "history";

    return (
        <div className="flex flex-col gap-2.5">
            {!isHistory && !readOnly && (
                <div
                    className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-primarydark sm:flex-row sm:items-center cursor-pointer"
                    onClick={onToggleAll}
                >
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={onToggleAll}
                        />
                        <span className="select-none text-sm font-semibold text-gray-700 dark:text-white">
                            {t("checkboxSelectAll")}
                        </span>
                    </div>
                    {selectedIds.size > 0 && (
                        <span className="text-xs font-semibold text-main dark:text-white sm:ml-auto">
                            {t("selectedCountLabel", { count: selectedIds.size })}
                        </span>
                    )}
                </div>
            )}

            {isHistory ? (
                <div className="flex flex-col gap-1.5">
                    <div className="xl:min-w-[1120px] flex flex-col gap-1.5">
                        <HistoryTableHeader />
                        {orders.map((order) => (
                            <OrderRow
                                key={order.id}
                                order={order}
                                checked={selectedIds.has(order.id)}
                                onToggle={onToggleOne}
                                onPrint={onPrintOne}
                                onDelete={onDeleteOne}
                                canDelete={canDelete}
                                variant={variant}
                                readOnly={readOnly}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    <TableHeader />
                    {orders.map((order) => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            checked={selectedIds.has(order.id)}
                            onToggle={onToggleOne}
                            onPrint={onPrintOne}
                            onDelete={onDeleteOne}
                            canDelete={canDelete}
                            variant={variant}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
OrdersTable.displayName = "OrdersTable";

export default OrdersTable;
