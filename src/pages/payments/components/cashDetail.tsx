import { memo, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Wallet2,
  EyeOff,
  Eye,
  Send,
  Store,
  Truck,
  CreditCard,
  PackageCheck,

} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import CashboxView from "./CashboxView";
import type { HistoryItem } from "./CashboxView";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

// ── Route state tipi ───────────────────────────────────────────────────────────
export interface DetailState {
  type: "market" | "courier";
  entity: { id: number; name: string; amount: number; region?: string };
}

// ── Statik config per type ─────────────────────────────────────────────────────
const CONFIG = {
  market: {
    kassaLabel: "Market kassasi",
    brand: "BEEPOST",
    headerIcon: <Store size={20} />,
    entityIcon: <Store size={18} className="text-white" />,
    actionLabel: "Pay",
    actionSub: "Marketga to'lov",
    submitLabel: "Pay",
    // purple gradient
    actionGradient: "from-[#4f46e5] to-purple",
    iconBg: "bg-main/30",
  },
  courier: {
    kassaLabel: "Kuryer kassasi",
    brand: "BEEPOST",
    headerIcon: <Truck size={20} />,
    entityIcon: <Truck size={18} className="text-white" />,
    actionLabel: "Receive",
    actionSub: "Kuryerdan qabul qilish",
    submitLabel: "Receive",
    // green gradient
    actionGradient: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-500/30",
  },
} as const;

// ── Mock ma'lumotlar (API ga ulanganda o'zgartiriladi) ─────────────────────────
const PAYMENT_TYPES = [
  { value: "", label: "payment type" },
  { value: "cash", label: "Naqd" },
  { value: "click", label: "Click" },
  { value: "payme", label: "Payme" },
  { value: "transfer", label: "Transfer" },
];

const HISTORY: HistoryItem[] = [
  { name: "Buxoro Axmed Aka", type: "Sotiv", method: "Naqd", amount: +930_000, time: "18:24", trend: "up" },
  { name: "Namangan Abdurahmon Aka", type: "Sotiv", method: "Naqd", amount: +930_000, time: "10:58", trend: "up" },
  { name: "Toshkent shahar Oybek aka", type: "Sotiv", method: "Naqd", amount: +840_000, time: "06:52", trend: "up" },
  { name: "Toshkent shahar Oybek aka", type: "Sotiv", method: "Naqd", amount: +930_000, time: "06:51", trend: "up" },
  { name: "Toshkent Shokh_Ali", type: "Sotiv", method: "Naqd", amount: +890_000, time: "05:10", trend: "up" },
  { name: "Namangan Abdurahmon Aka", type: "Sotiv", method: "Naqd", amount: +930_000, time: "04:45", trend: "up" },
  { name: "Buxoro Axmed Aka", type: "Qaytarma", method: "Naqd", amount: -200_000, time: "03:20", trend: "down" },
  { name: "Toshkent shahar Oybek aka", type: "Sotiv", method: "Click", amount: +840_000, time: "02:15", trend: "up" },
];

// ── CashDetail sahifasi ────────────────────────────────────────────────────────
const CashDetail = () => {
  const { state } = useLocation() as { state: DetailState | null };

  const type = state?.type ?? "market";
  const entity = state?.entity ?? { id: 0, name: "asl camera", amount: 24_271_000 };
  const cfg = CONFIG[type];
  const navigate = useNavigate();

  const [balanceVisible, setBalanceVisible] = useState(true);
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [comment, setComment] = useState("");

  // Income/expense bir marta hisoblanadi
  const { income, expense } = useMemo(() => ({
    income: HISTORY.filter((h) => h.amount > 0).reduce((s, h) => s + h.amount, 0),
    expense: HISTORY.filter((h) => h.amount < 0).reduce((s, h) => s + Math.abs(h.amount), 0),
  }), []);

  const handleSubmit = () => {
    // API integratsiyasi uchun joy
    console.log({ type, entity, amount, paymentType, comment });
  };

  return (
    <div className="p-6 bg-sidebar dark:bg-maindark min-h-full flex flex-col gap-6 rounded-2xl">
      {/* Header */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name={entity.name}
          description={cfg.kassaLabel}
          icon={cfg.headerIcon}
          onIconClick={() => navigate(-1)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Balance card */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-linear-to-br from-[#3b2f6e] via-[#2e2659] to-[#1e1a42] border border-white/10 shadow-2xl">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-500/25 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />

            {/* Brand + eye */}
            <div className="relative z-10 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
                  {cfg.entityIcon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{cfg.brand}</p>
                  <p className="text-[11px] text-white/40">{entity.name}</p>
                </div>
              </div>
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
              >
                {balanceVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>

            {/* Balance */}
            <div className="relative z-10">
              <p className="text-white/50 text-[11px] font-medium mb-1 flex items-center gap-1.5">
                <Wallet2 size={11} /> umumiyBalans
              </p>
              <p className="text-3xl font-black text-white tracking-tight">
                {balanceVisible ? `${fmt(entity.amount)} UZS` : "••••••• UZS"}
              </p>
            </div>
          </div>

          {/* Action banner button */}
          <button className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-sm bg-linear-to-r ${cfg.actionGradient} shadow-lg hover:brightness-110 transition-all`}>
            {type === "market" ? <CreditCard size={18} /> : <PackageCheck size={18} />}
            <span>{cfg.actionLabel}</span>
            <span className="text-white/60 font-normal text-xs">— {cfg.actionSub}</span>
          </button>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wide mb-1.5 ml-1">
              Amount <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 pr-16 rounded-xl text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-main/40 focus:border-main transition-all placeholder-gray-400 dark:placeholder-white/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-white/30">
                UZS
              </span>
            </div>
          </div>

          {/* Payment type */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wide mb-1.5 ml-1">
              payment type <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-main/40 focus:border-main transition-all appearance-none cursor-pointer"
              >
                {PAYMENT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value} className="dark:bg-[#1a1f3a]">
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-white/30">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wide mb-1.5 ml-1">
              Comment
            </label>
            <textarea
              placeholder="Comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-main/40 focus:border-main transition-all placeholder-gray-400 dark:placeholder-white/20 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm bg-linear-to-r ${cfg.actionGradient} shadow-lg hover:brightness-110 active:scale-[0.98] transition-all`}
          >
            <Send size={16} />
            {cfg.submitLabel}
          </button>
        </div>

        {/* RIGHT COLUMN — shared CashboxView */}
        <CashboxView income={income} expense={expense} history={HISTORY} />
      </div>
    </div>
  );
};

export default memo(CashDetail);