import { memo, useState, useMemo } from "react";
import {
  BadgeDollarSign,
  Store,
  Landmark,
  Truck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  CalendarDays,
} from "lucide-react";
import HeaderName from "../../shared/components/headerName";
import FilterSelect from "../../shared/ui/FilterSelect";
import PaymentHistoryTable from "./components/patmentHistoryTable";
import PopupSelect from "../../shared/components/popupSelect";
import { useNavigate } from "react-router-dom";
import { useCashBox } from "../../entities/payments";
import { useUser } from "../../entities/user/api/userApi";

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

// ── Dropdown filter config ────────────────────────────────────────────────────
const DROPDOWN_FILTERS = [
  { name: "operation_type", label: "Operation type", icon: TrendingUp },
  { name: "source_type", label: "Source type", icon: BadgeDollarSign },
  { name: "created_by", label: "Created by", icon: User },
] as const;

type DropdownKey = (typeof DROPDOWN_FILTERS)[number]["name"];

interface Filters extends Record<DropdownKey, string> {
  from_date: string;
  to_date: string;
}

const INIT: Filters = {
  operation_type: "",
  source_type: "",
  created_by: "",
  from_date: "",
  to_date: "",
};

// ── Asosiy sahifa ─────────────────────────────────────────────────────────────
const Payments = () => {
  const [filters, setFilters] = useState<Filters>(INIT);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [isGivenPopupOpen, setIsGivenPopupOpen] = useState(false);
  const [isReceivedPopupOpen, setIsReceivedPopupOpen] = useState(false);

  const setFilter = (key: keyof Filters) => (val: string) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const navigate = useNavigate();
  const { getFinanceHistory, getOperationTypes, getSourceTypes } = useCashBox();
  const { getUser } = useUser();

  // Faqat bo'sh bo'lmagan filterlarni API ga yuborish
  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, limit };
    (Object.entries(filters) as [keyof Filters, string][]).forEach(([key, value]) => {
      if (value) {
        params[key] = value;
      }
    });
    return params;
  }, [page, limit, filters]);

  const { data: historyData, isLoading: historyLoading } = getFinanceHistory(queryParams);

  const { data: opTypes, isLoading: opLoading } = getOperationTypes();
  const { data: srcTypes, isLoading: srcLoading } = getSourceTypes();
  const { data: creatorsData, isLoading: creatorsLoading } = getUser({ limit: 100 });

  // Optionlarni formatlash
  const opOptions = useMemo(
    () => (opTypes?.data || []).map((t: any) => ({ value: String(t.id), label: t.name })),
    [opTypes]
  );
  const srcOptions = useMemo(
    () => (srcTypes?.data || []).map((t: any) => ({ value: String(t.id), label: t.name })),
    [srcTypes]
  );
  const creatorOptions = useMemo(
    () =>
      (creatorsData?.data?.items || []).map((u: any) => ({
        value: String(u.id),
        label: u.name,
      })),
    [creatorsData]
  );

  const handleCardClick = (path: string | null, showPopup: "given" | "received" | null) => {
    if (showPopup === "given") setIsGivenPopupOpen(true);
    else if (showPopup === "received") setIsReceivedPopupOpen(true);
    else if (path) navigate(path);
  };

  const filterOptionsMap: Record<DropdownKey, { value: string; label: string }[]> = {
    operation_type: opOptions,
    source_type: srcOptions,
    created_by: creatorOptions,
  };

  const loadingMap: Record<DropdownKey, boolean> = {
    operation_type: opLoading,
    source_type: srcLoading,
    created_by: creatorsLoading,
  };

  // API pagination → component ken'g'lik
  const pagination = historyData?.data?.pagination ?? historyData?.data?.meta;

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark flex flex-col gap-6 min-h-full">
      {/* Header */}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Dropdown filterlar */}
          {DROPDOWN_FILTERS.map(({ name, label, icon }) => (
            <FilterSelect
              key={name}
              name={name}
              label={label}
              value={filters[name]}
              onChange={setFilter(name)}
              options={filterOptionsMap[name] || []}
              placeholder="Tanlang"
              icon={icon}
              loading={loadingMap[name]}
            />
          ))}

          {/* From date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-white/50 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-main" />
              From date
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilter("from_date")(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 dark:border-glass-border bg-white dark:bg-glass px-3 text-sm text-gray-700 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all dark:[color-scheme:dark]"
            />
          </div>

          {/* To date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-white/50 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-main" />
              To date
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilter("to_date")(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 dark:border-glass-border bg-white dark:bg-glass px-3 text-sm text-gray-700 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all dark:[color-scheme:dark]"
            />
          </div>
        </div>

        {/* Active filterlar & Reset */}
        {Object.values(filters).some(Boolean) && (
          <div className="flex items-center justify-end mt-3">
            <button
              onClick={() => {
                setFilters(INIT);
                setPage(1);
              }}
              className="text-xs text-rose-400 hover:text-rose-500 font-semibold flex items-center gap-1 transition-colors"
            >
              ✕ Filterlarni tozalash
            </button>
          </div>
        )}
      </div>

      {/* History table */}
      <PaymentHistoryTable
        data={historyData?.data?.items ?? []}
        isLoading={historyLoading}
        pagination={pagination}
        onPageChange={setPage}
        currentPage={page}
      />

      {/* To be given — market tanlash popup */}
      <PopupSelect
        isOpen={isGivenPopupOpen}
        onClose={() => setIsGivenPopupOpen(false)}
        data={MARKETS}
        title="To be given"
        description="Marketni tanlang"
        icon={<Store size={20} />}
        keyExtractor={(m: any) => m.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="amount"
        onSelect={(market: any) => {
          setIsGivenPopupOpen(false);
          navigate("/payments/cash-detail", {
            state: { type: "market", entity: market },
          });
        }}
        renderItem={(market: any, isSelected: boolean) => (
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
        keyExtractor={(c: any) => c.id}
        searchKeys={["name", "region"]}
        labelKey="name"
        onSelect={(courier: any) => {
          setIsReceivedPopupOpen(false);
          navigate("/payments/cash-detail", {
            state: { type: "courier", entity: courier },
          });
        }}
        renderItem={(courier: any, isSelected: boolean) => (
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
