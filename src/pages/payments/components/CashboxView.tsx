import { memo } from "react";
import {
    Clock,
    TrendingUp,
    TrendingDown,
    ChevronRight,
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

// ── Tip ta'riflar ─────────────────────────────────────────────────────────────
export interface HistoryItem {
    name: string;
    type: string;
    method: string;
    amount: number;
    time: string;
    trend: "up" | "down";
}

export interface CashboxViewProps {
    income: number;
    expense: number;
    history: HistoryItem[];
}

// ── Shared CashboxView komponenti ─────────────────────────────────────────────
// mainCashbox va cashDetail sahifalarida qayta ishlatiladi
const CashboxView = memo(({ income, expense, history }: CashboxViewProps) => {
    return (
        <div className="flex flex-col gap-5">
            {/* Today's transactions header */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-glass-border shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-main/20 flex items-center justify-center text-main">
                    <Clock size={18} />
                </div>
                <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                        Today's transactions
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/40">
                        Bugungi operatsiyalar
                    </p>
                </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
                {["Start date", "End date"].map((ph) => (
                    <div
                        key={ph}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-glass-border text-sm text-gray-400 dark:text-white/30"
                    >
                        <span>{ph}</span>
                        <Clock size={14} />
                    </div>
                ))}
            </div>

            {/* Income / Expense */}
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 bg-linear-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white/80 text-sm font-semibold">Income</span>
                        <TrendingUp size={18} className="text-white/70" />
                    </div>
                    <p className="text-2xl font-black text-white">+{fmt(income)}</p>
                    <p className="text-white/60 text-xs mt-1">UZS</p>
                </div>
                <div className="rounded-2xl p-5 bg-linear-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white/80 text-sm font-semibold">Expense</span>
                        <TrendingDown size={18} className="text-white/70" />
                    </div>
                    <p className="text-2xl font-black text-white">-{fmt(expense)}</p>
                    <p className="text-white/60 text-xs mt-1">UZS</p>
                </div>
            </div>

            {/* Payment history */}
            <div className="flex-1 rounded-2xl bg-primary dark:bg-primarydark border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-glass-border">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-main" />
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                Payment history
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-white/40">
                                So'nggi operatsiyalar
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-main/10 text-main px-2.5 py-1 rounded-lg text-xs font-bold">
                        ✦ {history.length} ta
                    </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-glass-border">
                    {history.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                        >
                            {/* Avatar */}
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.trend === "up" ? "bg-emerald-500/15" : "bg-rose-500/15"
                                    }`}
                            >
                                {item.trend === "up" ? (
                                    <TrendingUp size={16} className="text-emerald-400" />
                                ) : (
                                    <TrendingDown size={16} className="text-rose-400" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {item.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-gray-400 dark:text-white/40">
                                        {item.type}
                                    </span>
                                    <span className="flex items-center gap-0.5 text-[11px] text-emerald-500 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                        {item.method}
                                    </span>
                                </div>
                            </div>

                            {/* Amount + time */}
                            <div className="text-right shrink-0">
                                <p
                                    className={`text-sm font-bold ${item.amount > 0 ? "text-emerald-400" : "text-rose-400"
                                        }`}
                                >
                                    {item.amount > 0 ? "+" : ""}
                                    {fmt(item.amount)} so'm
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
                                    ⏱ {item.time} Bugun
                                </p>
                            </div>

                            <ChevronRight
                                size={14}
                                className="text-gray-300 dark:text-white/20 shrink-0"
                            />
                        </div>
                    ))}

                    {history.length === 0 && (
                        <div className="py-10 text-center text-gray-400 dark:text-white/30 text-sm">
                            Operatsiyalar yo'q
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

CashboxView.displayName = "CashboxView";
export default CashboxView;
