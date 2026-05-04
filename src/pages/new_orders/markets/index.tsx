import { memo, useMemo, useState, useEffect } from "react";
import { ChevronRight, Phone, ShoppingCart, Store, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
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
      <span className="font-medium text-maindark dark:text-gray-500">{index + 1}</span>
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
        <span className="font-semibold text-maindark dark:text-white">{v}</span>
      </div>
    ),
  },
  {
    key: "phone_number",
    label: "Telefon",
    width: "18%",
    render: (v) => (
      <span className="font-medium text-maindark dark:text-slate-300">{v}</span>
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
        <span className="font-bold text-maindark dark:text-white">{v} ta</span>
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
  <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-primarydark sm:p-4">
    <div className={`p-2.5 rounded-xl ${iconCls}`}>{icon}</div>
    <div className="flex min-w-0 flex-col">
      <span className="text-xs font-medium text-maindark dark:text-white/75">{label}</span>
      <strong className="truncate text-base leading-tight text-maindark dark:text-white sm:text-lg">{value}</strong>
    </div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const Markets = () => {
  const { t } = useTranslation("newOrders");
  const { getTodayOrders } = useOrders();
  const navigate = useNavigate();
  const roleState = useSelector((state: RootState) => state.role);
  const isMarketRole = roleState.role === "market";
  const marketId = roleState.id;

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

  useEffect(() => {
    if (!isMarketRole || !marketId) {
      return;
    }

    navigate(`/new-orders/${marketId}`, { replace: true });
  }, [isMarketRole, marketId, navigate]);

  const params = debouncedSearch.trim() ? { search: debouncedSearch.trim() } : undefined;
  const { data: response, isLoading } = getTodayOrders(params, !isMarketRole);

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

  if (isMarketRole) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-primary dark:border-primarydark/50 dark:bg-primarydark">
        <span className="text-sm font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          Yuklanmoqda...
        </span>
      </div>
    );
  }

  // Statistika
  const totalOrders = rows.reduce((s, r) => s + r.orders_count, 0);
  const totalSum = rows.reduce((s, r) => s + r.total_price_sum, 0);

  const renderMobileCard = (row: TableRow, index: number) => (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-primarydark/70 dark:bg-primarydark/70">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-maindark dark:text-gray-400">#{index + 1}</span>
        <ChevronRight size={16} className="text-maindark dark:text-gray-400" />
      </div>

      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-main/20">
          <Store size={15} />
        </div>
        <p className="truncate text-base font-bold text-maindark dark:text-primary">{row.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 dark:border-primarydark/70">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-maindark dark:text-gray-300">{t("phone")}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-maindark dark:text-gray-200">
            <Phone size={13} className="text-main/70" />
            {row.phone_number}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-maindark dark:text-gray-300">{t("orders")}</span>
          <span className="font-bold text-maindark dark:text-primary">{t("totalCount", { count: row.orders_count })}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-maindark dark:text-gray-300">{t("totalAmount")}</span>
          <span className="tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(row.total_price_sum)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-28 sm:space-y-6 sm:pb-24 md:pb-4">
      {/* Search */}
      <div>
        <GlobalSearchInput searchKey="market_search" placeholder={t("marketNameOrPhoneSearch")} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<Store size={20} />}
          label={t("marketsCount")}
          value={t("totalCount", { count: rows.length })}
          iconCls="bg-main/10 dark:bg-main/20 text-main"
        />
        <StatCard
          icon={<ShoppingCart size={20} />}
          label={t("totalOrders")}
          value={t("totalCount", { count: totalOrders })}
          iconCls="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label={t("totalAmount")}
          value={fmt(totalSum)}
          iconCls="bg-amber-500/10 dark:bg-amber-500/20 text-amber-500"
        />
      </div>

      {/* Jadval */}
      <Table<TableRow>
        data={rows}
        loading={isLoading}
        columns={columns.map((column) => {
          if (column.key === "name") return { ...column, label: t("marketName") };
          if (column.key === "phone_number") return { ...column, label: t("phone") };
          if (column.key === "orders_count") {
            return {
              ...column,
              label: t("orders"),
              render: (v: number) => (
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-main/10 dark:bg-main/20 flex items-center justify-center">
                    <ShoppingCart size={12} className="text-main" />
                  </span>
                  <span className="font-bold text-maindark dark:text-white">{t("totalCount", { count: v })}</span>
                </div>
              ),
            };
          }
          if (column.key === "total_price_sum") return { ...column, label: t("totalAmount") };
          return column;
        })}
        keyExtractor={(item) => item.market_id}
        onRowClick={(row) => navigate(`/new-orders/${row.market_id}`)}
        mobileRowRender={renderMobileCard}
        hoverable
        emptyMessage={t("noOrdersToday")}
      />
    </div>
  );
};

export default memo(Markets);
