import { memo, useEffect, useMemo, useState } from "react";
import { ChevronRight, Phone, ShoppingCart, Store, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useOrders } from "../../../entities/orders";
import { GlobalSearchInput, useDebounce } from "../../../features/search";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import { extractCancelledMarkets } from "./utils";

type MarketRow = {
  market_id: string;
  name: string;
  phone_number: string;
  orders_count: number;
  total_price_sum: number;
};

const formatMoney = (value: number, currencyLabel: string) =>
  `${value.toLocaleString("uz-UZ")} ${currencyLabel}`;

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3.5 shadow-sm dark:border-white/10 dark:bg-primarydark sm:p-4">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-300">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="m-0 text-xs font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
        {label}
      </p>
      <p className="m-0 truncate text-base font-extrabold text-maindark dark:text-white sm:text-lg">
        {value}
      </p>
    </div>
  </div>
);

const CancelledMarkets = () => {
  const { t } = useTranslation(["newOrders", "orders"]);
  const currencyLabel = t("currency", { ns: "orders" });
  const navigate = useNavigate();
  const { useCancelledMarkets } = useOrders();
  const search = useSelector((state: RootState) => (state.search.cancelled_market_search as string) || "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const applyDebounce = useDebounce((value: string) => setDebouncedSearch(value), 400);

  useEffect(() => {
    applyDebounce(search);
  }, [applyDebounce, search]);

  const query = useCancelledMarkets(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : undefined);
  const rows = useMemo<MarketRow[]>(() => extractCancelledMarkets(query.data), [query.data]);

  const columns = useMemo<ColumnConfig<MarketRow>[]>(
    () => [
      { key: "market_id", label: "#", width: "6%", render: (_, __, index) => index + 1 },
      {
        key: "name",
        label: t("marketName"),
        render: (value) => (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Store size={14} />
            </span>
            <span className="font-semibold text-maindark dark:text-white">{value}</span>
          </div>
        ),
      },
      {
        key: "phone_number",
        label: t("phone"),
        render: (value) => (
          <span className="font-medium text-maindark dark:text-white/75">{value}</span>
        ),
      },
      {
        key: "orders_count",
        label: t("orders"),
        render: (value) => (
          <span className="font-bold text-maindark dark:text-white">
            {t("orderCountValue", { count: value })}
          </span>
        ),
      },
      {
        key: "total_price_sum",
        label: t("totalAmount"),
        render: (value) => (
          <span className="tabular-nums font-bold text-red-600 dark:text-red-300">
            {formatMoney(Number(value), currencyLabel)}
          </span>
        ),
      },
    ],
    [currencyLabel, t],
  );

  const totalOrders = rows.reduce((sum, row) => sum + row.orders_count, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.total_price_sum, 0);

  return (
    <div className="space-y-4 pb-24 sm:space-y-6 md:pb-4">
      <GlobalSearchInput searchKey="cancelled_market_search" placeholder={t("marketNameOrPhoneSearch")} />

      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={<Store size={20} />}
              label={t("marketsCount")}
              value={t("totalCount", { count: rows.length })}
            />
            <StatCard
              icon={<ShoppingCart size={20} />}
              label={t("cancelledOrders")}
              value={t("totalCount", { count: totalOrders })}
            />
            <StatCard
              icon={<TrendingDown size={20} />}
              label={t("totalAmount")}
              value={formatMoney(totalAmount, currencyLabel)}
            />
          </div>

          <Table
            data={rows}
            columns={columns}
            loading={query.isLoading}
            keyExtractor={(row) => row.market_id}
            onRowClick={(row) => navigate(`/new-orders/cancelled/${row.market_id}`)}
            mobileRowRender={(row) => (
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-primarydark/70">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 truncate font-bold text-maindark dark:text-white">{row.name}</p>
                    <p className="m-0 mt-1 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                      <Phone size={12} /> {row.phone_number}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-red-500 dark:text-red-300" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--color-border-soft)] pt-3 dark:border-white/10">
                  <span className="font-semibold text-maindark dark:text-white/80">
                    {t("orderCountValue", { count: row.orders_count })}
                  </span>
                  <span className="tabular-nums font-bold text-red-600 dark:text-red-300">
                    {formatMoney(row.total_price_sum, currencyLabel)}
                  </span>
                </div>
              </div>
            )}
            emptyMessage={t("noCancelledOrders")}
            hoverable
          />
        </>
      )}
    </div>
  );
};

export default memo(CancelledMarkets);
