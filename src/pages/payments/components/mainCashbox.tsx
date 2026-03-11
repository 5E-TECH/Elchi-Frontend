import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  Eye,
  EyeOff,
  Download,
  LogOut,
  Clock,
  Banknote,
  ArrowLeftRight,
  Truck,
  Store,
  Minus,
  Plus,
  DollarSign,
  User,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import LogoTextDark from "../../../shared/assets/logoo.png";
import CashboxView from "./CashboxView";
import type { HistoryItem } from "./CashboxView";
import PopupSelect from "../../../shared/components/popupSelect";
import CashboxFormPopup from "./CashboxFormPopup";
import { useUser } from "../../../entities/user/api/userApi";
import { useCashBox } from "../../../entities/payments";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

type ActionLabel =
  | "Receive from courier"
  | "Pay to market"
  | "Spend from cashbox"
  | "Refill cashbox"
  | "Pay salary";

const ACTIONS: { icon: React.ReactNode; label: ActionLabel; color: string }[] = [
  { icon: <Truck size={22} />, label: "Receive from courier", color: "from-emerald-500 to-emerald-600" },
  { icon: <Store size={22} />, label: "Pay to market", color: "from-blue-500 to-blue-600" },
  { icon: <Minus size={22} />, label: "Spend from cashbox", color: "from-rose-500 to-rose-600" },
  { icon: <Plus size={22} />, label: "Refill cashbox", color: "from-emerald-500 to-teal-500" },
  { icon: <DollarSign size={22} />, label: "Pay salary", color: "from-amber-400 to-orange-500" },
];

const HISTORY: HistoryItem[] = [
  { name: "Abdullaev Shohruh", type: "Market to'lovi", method: "Naqd", amount: -10_000_000, time: "07:25", trend: "down" },
  { name: "Abdullaev Shohruh", type: "Market to'lovi", method: "Naqd", amount: -10_000_000, time: "07:25", trend: "down" },
  { name: "Abdullaev Shohruh", type: "Kuryer to'lovi", method: "Naqd", amount: +3_735_000, time: "01:05", trend: "up" },
  { name: "Abdullaev Shohruh", type: "Market to'lovi", method: "Click", amount: -7_426_000, time: "01:00", trend: "down" },
  { name: "Abdullaev Shohruh", type: "Kuryer to'lovi", method: "Naqd", amount: +7_426_000, time: "00:58", trend: "up" },
];

const MainCashbox = () => {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isSalaryPopupOpen, setIsSalaryPopupOpen] = useState(false);
  const [isCourierPopupOpen, setIsCourierPopupOpen] = useState(false);
  const [isMarketPopupOpen, setIsMarketPopupOpen] = useState(false);
  const [isSpendPopupOpen, setIsSpendPopupOpen] = useState(false);
  const [isRefillPopupOpen, setIsRefillPopupOpen] = useState(false);
  const navigate = useNavigate();

  const { getUser } = useUser();
  const { cashboxSpand, cashboxFill, getSourceTypes } = useCashBox();
  const { data: usersData, isLoading: usersLoading } = getUser({ limit: 100 });
  const { data: couriersData, isLoading: couriersLoading } = getUser({ role: "courier", limit: 100 });
  const { data: marketsData, isLoading: marketsLoading } = getUser({ role: "market", limit: 100 });
  const { data: srcTypesData } = getSourceTypes();
  const employees = usersData?.data?.items ?? [];
  const couriers = couriersData?.data?.items ?? [];
  const markets = marketsData?.data?.items ?? [];
  const sourceTypes = (srcTypesData?.data ?? []) as { id: string | number; name: string }[];

  const handleActionClick = (label: ActionLabel) => {
    if (label === "Pay salary") setIsSalaryPopupOpen(true);
    else if (label === "Receive from courier") setIsCourierPopupOpen(true);
    else if (label === "Pay to market") setIsMarketPopupOpen(true);
    else if (label === "Spend from cashbox") setIsSpendPopupOpen(true);
    else if (label === "Refill cashbox") setIsRefillPopupOpen(true);
  };

  const handleSalarySelect = (employee: any) => {
    setIsSalaryPopupOpen(false);
    console.log("Selected employee for salary:", employee);
    // TODO: salary to'lov formi
  };

  const handleCourierSelect = (courier: any) => {
    setIsCourierPopupOpen(false);
    navigate("/payments/cash-detail", {
      state: { type: "courier", entity: courier },
    });
  };

  const handleMarketSelect = (market: any) => {
    setIsMarketPopupOpen(false);
    navigate("/payments/cash-detail", {
      state: { type: "market", entity: market },
    });
  };

  return (
    <div className="p-6 bg-sidebar dark:bg-maindark min-h-full flex flex-col gap-6 rounded-2xl">
      {/* Header */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name="Main Cashbox"
          description="Asosiy kassa boshqaruvi"
          icon={<Wallet />}
          onIconClick={() => navigate(-1)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Balance card */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-linear-to-br from-[#3b2f6e] via-[#2e2659] to-[#1e1a42] border border-white/10 shadow-2xl">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/20 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-500/15 blur-2xl" />

            {/* Logo + eye */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <img src={LogoTextDark} alt="Elchi" className="w-18 object-contain hidden dark:block" />
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
                { icon: <Banknote size={16} />, label: "CASH", amount: 18_446_903 },
                { icon: <ArrowLeftRight size={16} />, label: "TRANSFER", amount: 13_101_000 },
              ].map(({ icon, label, amount }) => (
                <div key={label} className="bg-white/[0.07] border border-white/10 rounded-xl p-3.5 backdrop-blur-sm">
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
                onClick={() => handleActionClick(label)}
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
              <p className="text-sm font-bold text-gray-800 dark:text-white">Shift is open</p>
              <p className="text-xs text-emerald-500 font-medium">Abdullaev Shohruh</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — shared CashboxView */}
        <CashboxView
          income={14_750_000}
          expense={29_026_000}
          history={HISTORY}
        />
      </div>

      {/* Pay Salary — ishchi tanlash popup */}
      <PopupSelect
        isOpen={isSalaryPopupOpen}
        onClose={() => setIsSalaryPopupOpen(false)}
        data={usersLoading ? [] : employees}
        title="Select employee"
        description="Maosh to'lash uchun"
        icon={<User size={20} />}
        keyExtractor={(emp: any) => emp.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="role"
        onSelect={handleSalarySelect}
        placeholder="Search..."
        selectLabel="Select"
        cancelLabel="Cancel"
        renderItem={(emp: any, isSelected: boolean) => (
          <div className="flex items-center gap-3 w-full">
            {/* Avatar / Index */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${isSelected
                ? "bg-white/20 text-white"
                : "bg-amber-500/15 text-amber-500"
                }`}
            >
              {emp.name?.charAt(0)?.toUpperCase() ?? <User size={16} />}
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <p
                className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"
                  }`}
              >
                {emp.name}
              </p>
              {emp.role && (
                <p
                  className={`text-xs mt-0.5 capitalize ${isSelected ? "text-white/60" : "text-main"
                    }`}
                >
                  {emp.role}
                </p>
              )}
            </div>
          </div>
        )}
      />

      {/* Receive from courier popup */}
      <PopupSelect
        isOpen={isCourierPopupOpen}
        onClose={() => setIsCourierPopupOpen(false)}
        data={couriersLoading ? [] : couriers}
        title="Select courier"
        description="Kuryerdan qabul qilish"
        icon={<Truck size={20} />}
        keyExtractor={(c: any) => c.id}
        searchKeys={["name"]}
        onSelect={handleCourierSelect}
        placeholder="Search..."
        selectLabel="Select"
        cancelLabel="Cancel"
        renderItem={(c: any, isSelected: boolean) => (
          <div className="flex items-center gap-3 w-full">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-500"
              }`}>
              {c.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"
                }`}>{c.name}</p>
              {c.role && (
                <p className={`text-xs mt-0.5 capitalize ${isSelected ? "text-white/60" : "text-emerald-500"
                  }`}>{c.role}</p>
              )}
            </div>
          </div>
        )}
      />

      {/* Pay to market popup */}
      <PopupSelect
        isOpen={isMarketPopupOpen}
        onClose={() => setIsMarketPopupOpen(false)}
        data={marketsLoading ? [] : markets}
        title="Select market"
        description="Marketga to'lov qilish"
        icon={<Store size={20} />}
        keyExtractor={(m: any) => m.id}
        searchKeys={["name"]}
        onSelect={handleMarketSelect}
        placeholder="Search..."
        selectLabel="Select"
        cancelLabel="Cancel"
        renderItem={(m: any, isSelected: boolean) => (
          <div className="flex items-center gap-3 w-full">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-blue-500/15 text-blue-500"
              }`}>
              {m.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"
                }`}>{m.name}</p>
              {m.role && (
                <p className={`text-xs mt-0.5 capitalize ${isSelected ? "text-white/60" : "text-blue-400"
                  }`}>{m.role}</p>
              )}
            </div>
          </div>
        )}
      />

      {/* Spend from cashbox popup */}
      <CashboxFormPopup
        isOpen={isSpendPopupOpen}
        onClose={() => setIsSpendPopupOpen(false)}
        title="Spend from cashbox"
        description="Chiqim operatsiyasi"
        icon={<Minus size={20} />}
        accentColor="from-rose-500 to-rose-600"
        submitLabel="Receive"
        submitIcon={<Minus size={16} />}
        sourceTypes={sourceTypes}
        isLoading={cashboxSpand.isPending}
        onSubmit={({ amount, source_type_id, comment }) => {
          cashboxSpand.mutate(
            { data: { amount, source_type_id, comment } },
            { onSuccess: () => setIsSpendPopupOpen(false) }
          );
        }}
      />

      {/* Refill cashbox popup */}
      <CashboxFormPopup
        isOpen={isRefillPopupOpen}
        onClose={() => setIsRefillPopupOpen(false)}
        title="Refill cashbox"
        description="Kirim operatsiyasi"
        icon={<Plus size={20} />}
        accentColor="from-emerald-500 to-teal-500"
        submitLabel="Refill"
        submitIcon={<Plus size={16} />}
        sourceTypes={sourceTypes}
        isLoading={cashboxFill.isPending}
        onSubmit={({ amount, source_type_id, comment }) => {
          cashboxFill.mutate(
            { data: { amount, source_type_id, comment } },
            { onSuccess: () => setIsRefillPopupOpen(false) }
          );
        }}
      />
    </div>
  );
};

export default memo(MainCashbox);
