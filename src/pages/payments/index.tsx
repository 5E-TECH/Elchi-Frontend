import { memo, useState } from "react";
import {
  BadgeDollarSign,
  Store,
  Landmark,
  Truck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import HeaderName from "../../shared/components/headerName";
import FilterSelect from "../../shared/ui/FilterSelect";
import PaymentHistoryTable from "./components/patmentHistoryTable";
import PopupSelect from "../../shared/components/popupSelect";
import { useNavigate } from "react-router-dom";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

// ── To be given uchun mock ma'lumotlar ───────────────────────────────────────
const MARKETS = [
  { id: 1, name: "6060", amount: 20_036_003 },
  { id: 2, name: "0.13", amount: 0 },
  { id: 3, name: "Credigo", amount: 1_855_000 },
  { id: 4, name: "asl camera", amount: 24_271_000 },
  { id: 5, name: "076", amount: 0 },
  { id: 6, name: "023", amount: 0 },
  { id: 7, name: "Sog'lomHayot", amount: 0 },
  { id: 8, name: "donaxon.uz", amount: 185_000 },
  { id: 9, name: "1211", amount: 2_070_000 },
  { id: 10, name: "Shirina", amount: 0 },
  { id: 11, name: "865", amount: 1_000 },
  { id: 12, name: "2222", amount: 2_011_000 },
  { id: 13, name: "hayottabobat", amount: 0 },
];

// ── To be received uchun mock ma'lumotlar ────────────────────────────────────
const COURIERS = [
  { id: 1, name: "toshkent javlon aka", region: "Toshkent shahri", amount: 2_200_000 },
  { id: 2, name: "Shaxrizod Ismatov", region: "Toshkent shahri", amount: 2_407_000 },
  { id: 3, name: "Toshkent shahar Oybek aka", region: "Toshkent shahri", amount: 11_000 },
  { id: 4, name: "G'ijdivon Rustam Aka", region: "Buxoro", amount: 6_097_000 },
  { id: 5, name: "Buxoro Axmed Aka", region: "Buxoro", amount: 2_717_000 },
  { id: 6, name: "Toshkent shahar", region: "Toshkent shahri", amount: 164_000 },
  { id: 7, name: "Sirdaryo Abdurahmon Aka", region: "Sirdaryo", amount: 610_000 },
  { id: 8, name: "Toshkent Shokh_Ali", region: "Toshkent viloyati", amount: -19_741_999 },
  { id: 9, name: "Jizzax Alisher", region: "Jizzax", amount: 5_428_000 },
  { id: 10, name: "Navoiy Mehriddin Togo", region: "Navoiy", amount: -8_627_000 },
  { id: 11, name: "Samarqand Navro'z Aka", region: "Samarqand", amount: -22_061_998 },
  { id: 12, name: "Samarqand No'mon Aka", region: "Samarqand", amount: 0 },
  { id: 13, name: "Qashqadaryo Ramzi", region: "Qashqadaryo", amount: 5_322_000 },
];

// ── Stat cardlari ─────────────────────────────────────────────────────────────
const CARDS = [
  {
    label: "To be given",
    amount: 300_429_847,
    icon: <Store size={20} />,
    action: <ArrowUpRight size={16} />,
    bg: "bg-maindark",
    iconBg: "bg-main/20",
    badge: null,
    path: null,
    showPopup: "given" as const,
  },
  {
    label: "Amount in cashbox",
    amount: 31_547_903,
    icon: <Landmark size={20} />,
    action: <TrendingUp size={16} />,
    bg: "bg-gradient-to-br from-main to-main/80 shadow-main/30",
    iconBg: "bg-white/20",
    badge: "Asosiy kassa",
    path: "main-cashbox",
    showPopup: null as null,
  },
  {
    label: "To be received",
    amount: 78_527_844,
    icon: <Truck size={20} />,
    action: <ArrowDownLeft size={16} />,
    bg: "bg-maindark",
    iconBg: "bg-main/20",
    badge: null,
    path: null,
    showPopup: "received" as const,
  },
] as const;

// ── Filterlar ─────────────────────────────────────────────────────────────────
const FILTERS = [
  { name: "operation_type", label: "Operation type" },
  { name: "source_type", label: "Source type" },
  { name: "created_by", label: "Created by" },
  { name: "cashbox_type", label: "Cashbox type" },
] as const;

type FilterKey = (typeof FILTERS)[number]["name"];
type Filters = Record<FilterKey, string>;

const INIT: Filters = {
  operation_type: "",
  source_type: "",
  created_by: "",
  cashbox_type: "",
};

// ── Asosiy sahifa ─────────────────────────────────────────────────────────────
const Payments = () => {
  const [filters, setFilters] = useState<Filters>(INIT);
  const [isGivenPopupOpen, setIsGivenPopupOpen] = useState(false);
  const [isReceivedPopupOpen, setIsReceivedPopupOpen] = useState(false);

  const set = (key: FilterKey) => (val: string) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const navigate = useNavigate();

  const handleCardClick = (
    path: string | null,
    showPopup: "given" | "received" | null
  ) => {
    if (showPopup === "given") setIsGivenPopupOpen(true);
    else if (showPopup === "received") setIsReceivedPopupOpen(true);
    else if (path) navigate(path);
  };

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark flex flex-col gap-6 min-h-full">
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name="Payments"
          description="Kassa va to'lovlarni boshqarish"
          icon={<BadgeDollarSign />}
        />
      </div>

      {/* Stats */}
      <div className="flex items-stretch gap-4">
        {CARDS.map(({ label, amount, icon, action, bg, iconBg, badge, path, showPopup }) => (
          <div
            key={label}
            onClick={() => handleCardClick(path, showPopup)}
            className={`relative flex-1 overflow-hidden rounded-2xl p-6 border border-glass-border shadow-lg hover:scale-[1.02] transition-transform duration-300 ${bg} ${path || showPopup ? "cursor-pointer" : ""}`}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white opacity-[0.06]" />
            <div className="flex items-start justify-between mb-5">
              <div className={`flex items-center justify-center w-11 h-11 rounded-xl text-white ${iconBg}`}>
                {icon}
              </div>
              <div className="flex items-center gap-2">
                {badge && (
                  <div className="flex items-center gap-1.5 bg-glass px-2.5 py-1 rounded-lg border border-glass-border">
                    <TrendingUp size={11} className="text-white/80" />
                    <span className="text-white text-xs font-semibold">{badge}</span>
                  </div>
                )}
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/70">
                  {action}
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-white/60 mb-2">{label}</p>
            <p className="text-3xl font-extrabold text-white">{fmt(amount)}</p>
            <p className="text-xs text-white/40 mt-1.5">UZS</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-700 dark:text-white/70 mb-4">Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FILTERS.map(({ name, label }) => (
            <FilterSelect
              key={name}
              name={name}
              label={label}
              value={filters[name]}
              onChange={set(name)}
              options={[]}
              placeholder="Tanlang"
            />
          ))}
        </div>
      </div>

      {/* History table */}
      <PaymentHistoryTable />

      {/* To be given — market tanlash popup */}
      <PopupSelect
        isOpen={isGivenPopupOpen}
        onClose={() => setIsGivenPopupOpen(false)}
        data={MARKETS}
        title="To be given"
        description="Marketni tanlang"
        icon={<Store size={20} />}
        keyExtractor={(m) => m.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="amount"
        onSelect={(market) => {
          setIsGivenPopupOpen(false);
          navigate("/payments/cash-detail", {
            state: { type: "market", entity: market },
          });
        }}
        renderItem={(market, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${isSelected ? "bg-white/20 text-white" : "bg-main/10 text-main"
                  }`}
              >
                <Store size={16} />
              </div>
              <span className={`font-medium ${isSelected ? "text-white" : "text-gray-800 dark:text-white"}`}>
                {market.name}
              </span>
            </div>
            <span className={`text-sm font-semibold ${isSelected ? "text-white/80" : "text-gray-500 dark:text-white/50"}`}>
              {fmt(market.amount)} UZS
            </span>
          </div>
        )}
      />

      {/* To be received — kuryer tanlash popup */}
      <PopupSelect
        isOpen={isReceivedPopupOpen}
        onClose={() => setIsReceivedPopupOpen(false)}
        data={COURIERS}
        title="To be received"
        description="Kuryerni tanlang"
        icon={<Truck size={20} />}
        keyExtractor={(c) => c.id}
        searchKeys={["name", "region"]}
        labelKey="name"
        onSelect={(courier) => {
          setIsReceivedPopupOpen(false);
          navigate("/payments/cash-detail", {
            state: { type: "courier", entity: courier },
          });
        }}
        renderItem={(courier, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? "bg-white/20" : "bg-orange-500/10"
                  }`}
              >
                <Truck size={16} className={isSelected ? "text-white" : "text-orange-400"} />
              </div>
              <div>
                <p className={`font-medium text-sm ${isSelected ? "text-white" : "text-gray-800 dark:text-white"}`}>
                  {courier.name}
                </p>
                <p className={`text-xs ${isSelected ? "text-white/60" : "text-gray-400 dark:text-white/40"}`}>
                  {courier.region}
                </p>
              </div>
            </div>
            <span
              className={`text-sm font-semibold ${courier.amount < 0
                  ? "text-rose-400"
                  : isSelected
                    ? "text-white/80"
                    : "text-gray-500 dark:text-white/50"
                }`}
            >
              {courier.amount < 0 ? "-" : ""}
              {fmt(Math.abs(courier.amount))} UZS
            </span>
          </div>
        )}
      />
    </div>
  );
};

export default memo(Payments);
