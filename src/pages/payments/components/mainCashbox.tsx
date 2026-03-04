import { memo, useState } from "react";
import {
  Wallet,
  Eye,
  EyeOff,
  Download,
  LogOut,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Banknote,
  ArrowLeftRight,
  Truck,
  Store,
  Minus,
  Plus,
  DollarSign,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import LogoTextDark from "../../../shared/assets/logoo.png";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const ACTIONS = [
  {
    icon: <Truck size={22} />,
    label: "Receive from courier",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: <Store size={22} />,
    label: "Pay to market",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: <Minus size={22} />,
    label: "Spend from cashbox",
    color: "from-rose-500 to-rose-600",
  },
  {
    icon: <Plus size={22} />,
    label: "Refill cashbox",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: <DollarSign size={22} />,
    label: "Pay salary",
    color: "from-amber-400 to-orange-500",
  },
] as const;

const HISTORY = [
  {
    name: "Abdullaev Shohruh",
    type: "Market to'lovi",
    method: "Naqd",
    amount: -10_000_000,
    time: "07:25",
    trend: "down",
  },
  {
    name: "Abdullaev Shohruh",
    type: "Market to'lovi",
    method: "Naqd",
    amount: -10_000_000,
    time: "07:25",
    trend: "down",
  },
  {
    name: "Abdullaev Shohruh",
    type: "Kuryer to'lovi",
    method: "Naqd",
    amount: +3_735_000,
    time: "01:05",
    trend: "up",
  },
  {
    name: "Abdullaev Shohruh",
    type: "Market to'lovi",
    method: "Click",
    amount: -7_426_000,
    time: "01:00",
    trend: "down",
  },
  {
    name: "Abdullaev Shohruh",
    type: "Kuryer to'lovi",
    method: "Naqd",
    amount: +7_426_000,
    time: "00:58",
    trend: "up",
  },
] as const;

const MainCashbox = () => {
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <div className="p-6 bg-sidebar dark:bg-maindark min-h-full flex flex-col gap-6 rounded-2xl">
      {/* Header */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name="Main Cashbox"
          description="Asosiy kassa boshqaruvi"
          icon={<Wallet />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Balance card */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-linear-to-br from-[#3b2f6e] via-[#2e2659] to-[#1e1a42] border border-white/10 shadow-2xl">
            {/* Decorative circles */}
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/20 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-500/15 blur-2xl" />

            {/* Logo + eye */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <img
                  src={LogoTextDark}
                  alt="Elchi"
                  className="w-18 object-contain hidden dark:block"
                />
                <div className="text-2xl text-primary -ml-3.25">
                  <h2 className="font-extrabold">ELCHI</h2>
                  <p className="font-medium text-xs">POCHTA</p>
                </div>
              </div>
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
              >
                {balanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            {/* Balance */}
            <div className="relative z-10 mb-6">
              <p className="text-white/50 text-xs font-medium mb-1.5 flex items-center gap-1.5">
                <Wallet size={12} /> umumiyBalans
              </p>
              <p className="text-4xl font-black text-white tracking-tight">
                {balanceVisible ? `${fmt(31_547_903)} UZS` : "••••••• UZS"}
              </p>
            </div>

            {/* Cash / Transfer */}
            <div className="relative z-10 grid grid-cols-2 gap-3">
              {[
                {
                  icon: <Banknote size={16} />,
                  label: "CASH",
                  amount: 18_446_903,
                },
                {
                  icon: <ArrowLeftRight size={16} />,
                  label: "TRANSFER",
                  amount: 13_101_000,
                },
              ].map(({ icon, label, amount }) => (
                <div
                  key={label}
                  className="bg-white/[0.07] border border-white/10 rounded-xl p-3.5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5 text-white/50 text-[11px] font-bold uppercase tracking-wider mb-1.5">
                    {icon} {label}
                  </div>
                  <p className="text-white font-bold text-sm">
                    {balanceVisible ? `${fmt(amount)} UZS` : "••••••"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-5 gap-2">
            {ACTIONS.map(({ icon, label, color }) => (
              <button
                key={label}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-14 h-14 rounded-full bg-linear-to-br ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200`}
                >
                  {icon}
                </div>
                <span className="text-[10px] text-center text-gray-500 dark:text-white/50 leading-tight font-medium">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Export + Close Shift */}
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-main text-main text-sm font-semibold hover:bg-main/10 transition-colors">
              <Download size={16} /> Export to Excel
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-orange-500 text-orange-400 text-sm font-semibold hover:bg-orange-500/10 transition-colors">
              <LogOut size={16} /> Close Shift
            </button>
          </div>

          {/* Shift status */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-white">
                Shift is open
              </p>
              <p className="text-xs text-emerald-500 font-medium">
                Abdullaev Shohruh
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
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
                <span className="text-white/80 text-sm font-semibold">
                  Income
                </span>
                <TrendingUp size={18} className="text-white/70" />
              </div>
              <p className="text-2xl font-black text-white">
                +{fmt(14_750_000)}
              </p>
              <p className="text-white/60 text-xs mt-1">UZS</p>
            </div>
            <div className="rounded-2xl p-5 bg-linear-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/80 text-sm font-semibold">
                  Expense
                </span>
                <TrendingDown size={18} className="text-white/70" />
              </div>
              <p className="text-2xl font-black text-white">
                -{fmt(29_026_000)}
              </p>
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
                {/* gear icon */}✦ {HISTORY.length} ta
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-glass-border">
              {HISTORY.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.trend === "up" ? "bg-emerald-500/15" : "bg-rose-500/15"}`}
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
                      className={`text-sm font-bold ${item.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MainCashbox);
