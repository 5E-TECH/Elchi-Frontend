import { memo } from "react";
import {
    X,
    TrendingUp,
    TrendingDown,
    MessageSquare,
    ArrowRight,
    CreditCard,
    Calendar,
    User,
    Landmark,
    ExternalLink,
} from "lucide-react";
import Popup from "../../../shared/ui/Popup";
import type { PaymentRow } from "./patmentHistoryTable";

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.abs(n).toLocaleString("uz-UZ");

const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
        return dateStr;
    }
};

// ─── InfoCard ─────────────────────────────────────────────────────────────────

interface InfoCardProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    accent?: string;   // tailwind bg color
    fullWidth?: boolean;
}

const InfoCard = memo(({ icon, label, value, accent = "bg-main/15", fullWidth }: InfoCardProps) => (
    <div
        className={`flex flex-col gap-1.5 rounded-xl p-3.5
      bg-white/5 border border-white/10
      ${fullWidth ? "col-span-2" : ""}`}
    >
        <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${accent}`}>
                {icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {label}
            </span>
        </div>
        <div className="text-[13px] font-semibold text-white/90 pl-0.5">{value}</div>
    </div>
));

InfoCard.displayName = "InfoCard";

// ─── FinanceHistoryDetailPopup ────────────────────────────────────────────────

interface Props {
    row: PaymentRow | null;
    onClose: () => void;
}

const FinanceHistoryDetailPopup = memo(({ row, onClose }: Props) => {
    if (!row) return null;

    const isIncome = row.operation_type === "income";

    // Gradient: income → green, expense → red/pink
    const headerGrad = isIncome
        ? "from-emerald-500 via-green-500 to-teal-500"
        : "from-rose-500 via-pink-500 to-red-500";

    const accentBg = isIncome ? "bg-emerald-400/20" : "bg-rose-400/20";
    const accentText = isIncome ? "text-emerald-400" : "text-rose-400";

    const directionLabel = isIncome ? "Qayerdan" : "Qayerga";
    const sourceValue = row.source_id ?? "—";

    return (
        <Popup isShow={!!row} onClose={onClose}>
            <div
                className="w-[92vw] max-w-[360px] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                style={{ background: "#1a1730", maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className={`relative bg-gradient-to-br ${headerGrad} px-5 py-4`}>
                    {/* Icon + title */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                {isIncome
                                    ? <TrendingUp size={20} className="text-white" />
                                    : <TrendingDown size={20} className="text-white" />}
                            </div>
                            <div>
                                <p className="text-[15px] font-bold text-white leading-tight">
                                    {isIncome ? "Income" : "Expense"}
                                </p>
                                <p className="text-[11px] text-white/70 flex items-center gap-1 mt-0.5">
                                    <Landmark size={11} />
                                    Payment history
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <X size={16} className="text-white" />
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/20 my-3.5" />

                    {/* Amount */}
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[11px] text-white/60 mb-1">Amount</p>
                            <p className="text-[28px] font-extrabold text-white leading-none">
                                {isIncome ? "+" : "-"}{fmt(row.amount)}
                                <span className="text-[14px] font-semibold text-white/70 ml-1.5">UZS</span>
                            </p>
                        </div>
                        {row.balance_after !== undefined && (
                            <div className="text-right">
                                <p className="text-[10px] text-white/50">Balance after transaction</p>
                                <p className={`text-[13px] font-bold ${row.balance_after < 0 ? "text-white/60" : "text-white"}`}>
                                    {row.balance_after < 0 ? "-" : ""}{fmt(row.balance_after)} UZS
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Body ── */}
                <div
                    className="flex flex-col gap-3 p-4 overflow-y-auto custom-scrollbar"
                    style={{ maxHeight: "calc(90vh - 200px)" }}
                >
                    {/* Comment */}
                    {row.comment && (
                        <div
                            className="flex items-start gap-3 rounded-xl p-3.5 border"
                            style={{
                                background: isIncome ? "rgba(52,211,153,0.07)" : "rgba(244,63,94,0.07)",
                                borderColor: isIncome ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)",
                            }}
                        >
                            <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentBg}`}
                            >
                                <MessageSquare size={16} className={accentText} />
                            </div>
                            <div>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${accentText}`}>
                                    Comment
                                </p>
                                <p className="text-[13px] text-white/80 leading-relaxed">{row.comment}</p>
                            </div>
                        </div>
                    )}

                    {/* Direction (Qayerdan / Qayerga) */}
                    {sourceValue !== "—" && (
                        <div
                            className="flex items-center gap-3 rounded-xl p-3.5 border"
                            style={{
                                background: isIncome ? "rgba(52,211,153,0.07)" : "rgba(244,63,94,0.07)",
                                borderColor: isIncome ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)",
                            }}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentBg}`}>
                                <ArrowRight size={16} className={accentText} />
                            </div>
                            <div>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${accentText}`}>
                                    {directionLabel}
                                </p>
                                <p className="text-[14px] font-bold text-white">{sourceValue}</p>
                            </div>
                        </div>
                    )}

                    {/* Grid cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {/* Source type */}
                        <InfoCard
                            icon={<CreditCard size={12} className="text-main" />}
                            label="Source type"
                            accent="bg-main/15"
                            value={<span className="capitalize">{row.source_type || "—"}</span>}
                        />

                        {/* Payment method */}
                        <InfoCard
                            icon={<CreditCard size={12} className="text-main" />}
                            label="To'lov turi"
                            accent="bg-main/15"
                            value={<span className="capitalize">{row.payment_method || "—"}</span>}
                        />

                        {/* Payment date */}
                        <InfoCard
                            icon={<Calendar size={12} className="text-main" />}
                            label="Payment date"
                            accent="bg-main/15"
                            value={formatDate(row.payment_date ?? row.createdAt)}
                            fullWidth
                        />

                        {/* User / Created by */}
                        {row.created_by && (
                            <InfoCard
                                icon={<User size={12} className="text-main" />}
                                label="User"
                                accent="bg-main/15"
                                fullWidth
                                value={
                                    <div className="flex items-center gap-2">
                                        <span>{row.created_by}</span>
                                        {row.cashbox?.cashbox_type && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-warning/15 text-warning font-medium capitalize">
                                                {row.cashbox.cashbox_type}
                                            </span>
                                        )}
                                    </div>
                                }
                            />
                        )}
                    </div>

                    {/* Cashbox info */}
                    {row.cashbox && (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            {/* Cashbox header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIncome ? "bg-emerald-400/15" : "bg-rose-400/15"}`}>
                                        <Landmark size={15} className={accentText} />
                                    </div>
                                    <div>
                                        <p className={`text-[11px] font-bold uppercase tracking-wider ${accentText}`}>
                                            Cashbox
                                        </p>
                                        <p className="text-white font-bold text-[13px]">
                                            #{row.cashbox.id}
                                        </p>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="text-white/30" />
                            </div>

                            {/* Cashbox details */}
                            <div className="divide-y divide-white/[0.06]">
                                <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                                    <span className="text-white/50">Balance</span>
                                    <span className="font-bold text-white">{fmt(row.cashbox.balance)} UZS</span>
                                </div>
                                <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                                    <span className="text-white/50">Type</span>
                                    <span className="font-bold text-white capitalize">{row.cashbox.cashbox_type}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Popup>
    );
});

FinanceHistoryDetailPopup.displayName = "FinanceHistoryDetailPopup";

export default FinanceHistoryDetailPopup;
