import { memo, useMemo, useState, useEffect } from "react";
import { ShoppingCart, Store, TrendingUp } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useOrders } from "../../../entities/orders";
import { useNavigate } from "react-router-dom";
import { GlobalSearchInput, useDebounce } from "../../../features/search";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";

// ─── API dan kelgan tuzilma ──────────────────────────────────────────────────
interface MarketInfo {
  id: string;
  name: string;
  phone_number: string;
  status: "active" | "inactive";
  default_tariff: "center" | "home";
  tariff_center: number;
  tariff_home: number;
}

interface TodayOrder {
  market_id: string;
  orders_count: number;
  total_price_sum: number;
  market: MarketInfo;
}

// ─── Jadval uchun flat tuzilma ───────────────────────────────────────────────
interface TableRow {
  market_id: string;
  name: string;
  phone_number: string;
  orders_count: number;
  total_price_sum: number;
}

// ─── Format helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("uz-UZ") + " so'm";

// ─── Columns ─────────────────────────────────────────────────────────────────
const columns: ColumnConfig<TableRow>[] = [
  {
    key: "market_id",
    label: "#",
    width: "6%",
    render: (_v, _row, index) => (
      <span className="text-gray-400 dark:text-gray-500 font-medium">{index + 1}</span>
    ),
  },
  {
    key: "name",
    label: "Market nomi",
    width: "22%",
    sortable: true,
    render: (v) => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-main/10 dark:bg-main/20 flex items-center justify-center shrink-0">
          <Store size={14} className="text-main" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-white">{v}</span>
      </div>
    ),
  },
  {
    key: "phone_number",
    label: "Telefon",
    width: "18%",
    render: (v) => (
      <span className="text-gray-600 dark:text-slate-300 font-medium">{v}</span>
    ),
  },
  {
    key: "orders_count",
    label: "Buyurtmalar",
    width: "25%",
    sortable: true,
    render: (v) => (
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-main/10 dark:bg-main/20 flex items-center justify-center">
          <ShoppingCart size={12} className="text-main" />
        </span>
        <span className="font-bold text-gray-900 dark:text-white">{v} ta</span>
      </div>
    ),
  },
  {
    key: "total_price_sum",
    label: "Jami summa",
    width: "28%",
    sortable: true,
    render: (v) => (
      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
        {fmt(v)}
      </span>
    ),
  },
];

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, iconCls }: {
  icon: React.ReactNode; label: string; value: string | number; iconCls: string;
}) => (
  <div className="flex items-center gap-3 p-4 rounded-2xl w-full bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10">
    <div className={`p-2.5 rounded-xl ${iconCls}`}>{icon}</div>
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <strong className="text-lg text-gray-800 dark:text-white leading-tight">{value}</strong>
    </div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const Markets = () => {
  const { getTodayOrders } = useOrders();
  const navigate = useNavigate();

  // Redux dan search qiymatini olish (GlobalSearchInput Redux ga yozadi)
  const searchQuery = useSelector((state: RootState) =>
    (state.search["market_search"] as string) || ""
  );

  // Backend ga yuborish uchun debounce (500ms)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const applyDebounce = useDebounce((val: string) => setDebouncedSearch(val), 500);

  useEffect(() => {
    applyDebounce(searchQuery);
  }, [searchQuery, applyDebounce]);

  const params = debouncedSearch.trim() ? { search: debouncedSearch.trim() } : undefined;
  const { data: response, isLoading } = getTodayOrders(params);

  // API dan kelgan array ni jadval uchun flat qilamiz
  const rows: TableRow[] = useMemo(() => {
    const list: TodayOrder[] = response?.data ?? response ?? [];
    return list.map((item) => ({
      market_id: item.market_id,
      name: item.market?.name ?? "—",
      phone_number: item.market?.phone_number ?? "—",
      orders_count: item.orders_count,
      total_price_sum: item.total_price_sum,
    }));
  }, [response]);

  // Statistika
  const totalOrders = rows.reduce((s, r) => s + r.orders_count, 0);
  const totalSum = rows.reduce((s, r) => s + r.total_price_sum, 0);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <GlobalSearchInput searchKey="market_search" placeholder="Market nomi yoki telefon qidirish..." />
      </div>
      <div className="flex items-center justify-between gap-4">
        <StatCard
          icon={<Store size={20} />}
          label="Marketlar"
          value={`${rows.length} ta`}
          iconCls="bg-main/10 dark:bg-main/20 text-main"
        />
        <StatCard
          icon={<ShoppingCart size={20} />}
          label="Jami buyurtmalar"
          value={`${totalOrders} ta`}
          iconCls="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Umumiy summa"
          value={fmt(totalSum)}
          iconCls="bg-amber-500/10 dark:bg-amber-500/20 text-amber-500"
        />
      </div>

      {/* Jadval */}
      <Table<TableRow>
        data={rows}
        loading={isLoading}
        columns={columns}
        keyExtractor={(item) => item.market_id}
        onRowClick={(row) => navigate(`/new-orders/${row.market_id}`)}
        hoverable
        emptyMessage="Bugun buyurtma yo'q"
      />
    </div>
  );
};

export default memo(Markets);