import { memo, useEffect, useMemo, useState } from "react";
import { ListOrdered, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Button from "../../shared/components/button";
import { useOrders } from "../../entities/order/api/orderApi";
import type { OrderListItem, OrderListParams } from "../../entities/order/types/order";
import OrderFilters, { ORDER_FILTER_KEYS } from "./list/OrderFilters";
import OrdersTable from "./list/OrdersTable";
import OrderPagination from "./list/OrderPagination";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import type { RootState } from "../../app/config/store";
import CourierOrders from "./list/courier/index"

const LIMIT = 15;


// ── Main component ─────────────────────────────────────────────────────────
const Orders = () => {
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const { getOrders } = useOrders();
  const { getAllParams } = useQueryParams();

  // Redux filterlarni olish (UserListPage patterndek)
  const filters = useSelector((state: RootState) => state.filter);
  const searchFilters = useSelector((state: RootState) => state.search);
  const role = useSelector((state: RootState) => state.role.role);


  // Pagination
  const [page, setPage] = useState(1);

  // URL params
  const urlParams = getAllParams();

  // API params qurishda Redux + URL params birga ishlatiladi (UserListPage patterndek)
  const apiParams = useMemo((): OrderListParams => {
    const params: OrderListParams = {
      page,
      limit: LIMIT,
    };

    // Market
    if (role !== "market") {
      const marketId = urlParams[ORDER_FILTER_KEYS.marketId] || filters[ORDER_FILTER_KEYS.marketId];
      if (marketId) params.market_id = String(marketId);
    }

    // Viloyat / Region
    const regionId = urlParams[ORDER_FILTER_KEYS.regionId] || filters[ORDER_FILTER_KEYS.regionId];
    if (regionId) params.region_id = String(regionId);

    // Kuryer
    if (role !== "market") {
      const courierId = urlParams[ORDER_FILTER_KEYS.courierId] || filters[ORDER_FILTER_KEYS.courierId];
      if (courierId) params.courier_id = String(courierId);
    }

    // Holat
    const status = urlParams[ORDER_FILTER_KEYS.status] || filters[ORDER_FILTER_KEYS.status];
    if (status) params.status = String(status) as OrderListParams["status"];

    // Sana oralig'i
    const dateFrom = urlParams[ORDER_FILTER_KEYS.dateFrom] || filters[ORDER_FILTER_KEYS.dateFrom];
    if (dateFrom) params.start_day = String(dateFrom);

    const dateTo = urlParams[ORDER_FILTER_KEYS.dateTo] || filters[ORDER_FILTER_KEYS.dateTo];
    if (dateTo) params.end_day = String(dateTo);

    // Qidiruv (searchSlice)
    const search =
      urlParams[ORDER_FILTER_KEYS.search] || searchFilters[ORDER_FILTER_KEYS.search];
    if (search) params.search = search;

    return params;
  }, [page, urlParams, filters, searchFilters]);

  // Filter o'zgarganda sahifani 1 ga qaytarish
  useEffect(() => {
    setPage(1);
  }, [
    role !== "market" ? filters[ORDER_FILTER_KEYS.marketId] : null,
    filters[ORDER_FILTER_KEYS.regionId],
    role !== "market" ? filters[ORDER_FILTER_KEYS.courierId] : null,
    filters[ORDER_FILTER_KEYS.status],
    filters[ORDER_FILTER_KEYS.dateFrom],
    filters[ORDER_FILTER_KEYS.dateTo],
    searchFilters[ORDER_FILTER_KEYS.search],
  ]);

  const { data, isLoading } = getOrders(apiParams);

  const items: OrderListItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT) || 1;

  if (role === "courier") {
    return (
      <div>
        <CourierOrders/>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-sidebar p-3 sm:p-4 lg:p-6 dark:bg-maindark flex flex-col gap-4 sm:gap-5 min-h-full">

      {/* ── Header ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 rounded-2xl bg-main/5 px-1 py-1.5 sm:bg-transparent sm:px-0 sm:py-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main text-primary shadow-lg shadow-main/20">
              <ListOrdered size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-[16px] font-bold leading-tight text-main dark:text-primary">
                {t("list")}
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t("totalOrdersSummary", { count: total })}
              </p>
            </div>
          </div>
          <Button
            label={t("newOrders")}
            icon={<Plus size={16} />}
            onClick={() => navigate("add")}
            className="w-full rounded-2xl py-3 text-sm shadow-lg shadow-main/20 sm:w-auto sm:rounded-xl sm:py-2.5"
          />
        </div>
      </div>

      {/* ── Filters + Table ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm flex flex-col gap-4 p-3 sm:p-4 lg:p-5">

        {/* Filters */}
        <OrderFilters
          onExport={() => console.log("Export Excel:", apiParams)}
        />

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-primarydark/60" />

        {/* Table */}
        <OrdersTable
          data={items}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {!isLoading && (
          <OrderPagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onChange={(p) => setPage(p)}
          />
        )}
      </div>
    </div>
  );
};

export default memo(Orders);
