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
import { useNavigate } from "react-router-dom";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const CARDS = [
  {
    label: "To be given",
    amount: 300429847,
    icon: <Store size={20} />,
    action: <ArrowUpRight size={16} />,
    bg: "bg-maindark",
    iconBg: "bg-main/20",
    badge: null,
    path: null,
  },
  {
    label: "Amount in cashbox",
    amount: 31547903,
    icon: <Landmark size={20} />,
    action: <TrendingUp size={16} />,
    bg: "bg-gradient-to-br from-main to-main/80 shadow-main/30",
    iconBg: "bg-white/20",
    badge: "Asosiy kassa",
    path: "main-cashbox",
  },
  {
    label: "To be received",
    amount: 78527844,
    icon: <Truck size={20} />,
    action: <ArrowDownLeft size={16} />,
    bg: "bg-maindark",
    iconBg: "bg-main/20",
    badge: null,
    path: null,
  },
] as const;

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

const Payments = () => {
  const [filters, setFilters] = useState<Filters>(INIT);
  const set = (key: FilterKey) => (val: string) =>
    setFilters((f) => ({ ...f, [key]: val }));


  const navigate = useNavigate();

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
        {CARDS.map(({ label, amount, icon, action, bg, iconBg, badge, path }) => (
          <div
            key={label}
            onClick={() => path && navigate(path)}
            className={`relative flex-1 overflow-hidden rounded-2xl p-6 border border-glass-border shadow-lg hover:scale-[1.02] transition-transform duration-300 ${bg} ${path ? "cursor-pointer" : ""}`}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white opacity-[0.06]" />
            <div className="flex items-start justify-between mb-5">
              <div
                className={`flex items-center justify-center w-11 h-11 rounded-xl text-white ${iconBg}`}
              >
                {icon}
              </div>
              <div className="flex items-center gap-2">
                {badge && (
                  <div className="flex items-center gap-1.5 bg-glass px-2.5 py-1 rounded-lg border border-glass-border">
                    <TrendingUp size={11} className="text-white/80" />
                    <span className="text-white text-xs font-semibold">
                      {badge}
                    </span>
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
        <p className="text-sm font-bold text-gray-700 dark:text-white/70 mb-4">
          Filters
        </p>
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
    </div>
  );
};

export default memo(Payments);
