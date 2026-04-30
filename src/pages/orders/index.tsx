import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BookMarked, ListOrdered, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Button from "../../shared/components/button";
import HeaderName from "../../shared/components/headerName";
import { useOrders } from "../../entities/order/api/orderApi";
import { useMarkets } from "../../entities/markets";
import type { OrderListItem, OrderListParams, OrderStatus } from "../../entities/order/types/order";
import OrderFilters, { ORDER_FILTER_KEYS } from "./list/OrderFilters";
import OrdersTable from "./list/OrdersTable";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import type { RootState } from "../../app/config/store";
import CourierOrders from "./list/courier/index";
import { usePagination } from "../../shared/lib/usePagination";
import Pagination from "../../shared/components/pagination";
import PopupSelect from "../../shared/components/popupSelect";
import type { MarketOption } from "./create/model/orderCreateForm";

const LIMIT = 10;
const isOrderStatus = (value: string): value is OrderStatus =>
  [
    "created",
    "new",
    "received",
    "on the road",
    "waiting",
    "sold",
    "cancelled",
    "paid",
    "partly_paid",
    "closed",
  ].includes(value);

const parseStatusFilterValue = (value: unknown): OrderListParams["status"] => {
  if (Array.isArray(value)) {
    const normalizedValue = value.filter(
      (item): item is OrderStatus => typeof item === "string" && isOrderStatus(item),
    );

    return normalizedValue.length > 0 ? normalizedValue : "";
  }

  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const statusList = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is OrderStatus => isOrderStatus(item));

  if (statusList.length === 0) {
    return "";
  }

  return statusList;
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};


// ── Main component ─────────────────────────────────────────────────────────
const Orders = () => {
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const { getOrders } = useOrders();
  const { getMarkets } = useMarkets();
  const { getAllParams } = useQueryParams();
  const [showMarketSelect, setShowMarketSelect] = useState(false);

  const role = useSelector((state: RootState) => state.role.role);


  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "orders",
    defaultLimit: LIMIT,
  });
  const previousFiltersKeyRef = useRef("");

  // URL params
  const urlParams = getAllParams();
  const urlMarketId = urlParams[ORDER_FILTER_KEYS.marketId] ?? "";
  const urlRegionId = urlParams[ORDER_FILTER_KEYS.regionId] ?? "";
  const urlCourierId = urlParams[ORDER_FILTER_KEYS.courierId] ?? "";
  const urlStatusRaw = urlParams[ORDER_FILTER_KEYS.status] ?? "";
  const urlDateFrom = urlParams[ORDER_FILTER_KEYS.dateFrom] ?? urlParams.orderDateFrom ?? "";
  const urlDateTo = urlParams[ORDER_FILTER_KEYS.dateTo] ?? urlParams.orderDateTo ?? "";
  const urlSearch = urlParams[ORDER_FILTER_KEYS.search] ?? "";

  // API params qurishda Redux + URL params birga ishlatiladi (UserListPage patterndek)
  const apiParams = useMemo((): OrderListParams => {
    const params: OrderListParams = {
      page,
      limit,
    };

    // Market
    if (role !== "market") {
      const marketId = urlMarketId;
      if (marketId) params.market_id = String(marketId);
    }

    // Viloyat / Region
    const regionId = urlRegionId;
    if (regionId) params.region_id = String(regionId);

    // Kuryer
    if (role !== "market") {
      const courierId = urlCourierId;
      if (courierId) params.courier_id = String(courierId);
    }

    // Holat
    const status = parseStatusFilterValue(urlStatusRaw);
    if (Array.isArray(status) ? status.length > 0 : Boolean(status)) {
      params.status = status;
    }

    // Sana oralig'i
    const dateFrom = urlDateFrom;
    if (dateFrom) params.start_day = String(dateFrom);

    const dateTo = urlDateTo;
    if (dateTo) params.end_day = String(dateTo);

    // Qidiruv (searchSlice)
    const search = urlSearch;
    if (search) params.search = search;

    return params;
  }, [
    page,
    limit,
    role,
    urlMarketId,
    urlRegionId,
    urlCourierId,
    urlStatusRaw,
    urlDateFrom,
    urlDateTo,
    urlSearch,
  ]);

  const filtersKey = useMemo(
    () => {
      const status = parseStatusFilterValue(urlStatusRaw);

      return JSON.stringify({
        role,
        marketId: role !== "market" ? urlMarketId : "",
        regionId: urlRegionId,
        courierId: role !== "market" ? urlCourierId : "",
        status: Array.isArray(status) ? status.join(",") : status,
        dateFrom: urlDateFrom,
        dateTo: urlDateTo,
        search: urlSearch,
      });
    },
    [
      role,
      urlMarketId,
      urlRegionId,
      urlCourierId,
      urlStatusRaw,
      urlDateFrom,
      urlDateTo,
      urlSearch,
    ],
  );

  // Filter o'zgarganda sahifani 1 ga qaytarish
  useEffect(() => {
    if (!previousFiltersKeyRef.current) {
      previousFiltersKeyRef.current = filtersKey;
      return;
    }

    if (previousFiltersKeyRef.current === filtersKey) {
      return;
    }

    previousFiltersKeyRef.current = filtersKey;
    resetPagination(LIMIT);
  }, [filtersKey, resetPagination]);

  const { data, isLoading } = getOrders(apiParams);
  const { data: marketsResponse, isLoading: isMarketsLoading } = getMarkets(
    { limit: 100 },
    showMarketSelect,
  );

  const markets = useMemo<MarketOption[]>(() => {
    const payload = marketsResponse as
      | { data?: { items?: MarketOption[] } }
      | { data?: MarketOption[] }
      | MarketOption[]
      | undefined;

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    if (Array.isArray(payload?.data?.items)) {
      return payload.data.items;
    }

    return [];
  }, [marketsResponse]);

  const rawPagination = (data as { meta?: Record<string, unknown>; pagination?: Record<string, unknown> } | undefined)?.meta
    ?? (data as { pagination?: Record<string, unknown> } | undefined)?.pagination
    ?? {};
  const items: OrderListItem[] = data?.data ?? [];
  const currentPage = toPositiveNumber(data?.page ?? rawPagination.page) ?? page;
  const itemsPerPage = toPositiveNumber(data?.limit ?? rawPagination.limit) ?? limit;
  const total = toPositiveNumber(data?.total ?? rawPagination.total) ?? items.length;

  if (role === "courier") {
    return (
      <div>
        <CourierOrders />
      </div>
    );
  }

  const handleOpenNewOrder = () => {
    if (role === "market") {
      navigate("add");
      return;
    }

    setShowMarketSelect(true);
  };

  const handleSelectMarket = (market: MarketOption) => {
    navigate("add", {
      state: {
        selectedMarket: market,
      },
    });
  };

  return (
    <div className="rounded-2xl bg-sidebar p-3 sm:p-4 lg:p-6 dark:bg-maindark flex flex-col gap-4 sm:gap-5 min-h-full">

      {/* ── Header ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <HeaderName
            name={t("list")}
            description={t("totalOrdersSummary", { count: total })}
            icon={<ListOrdered />}
          />
          <Button
            label={t("newOrders")}
            icon={<Plus size={16} />}
            onClick={handleOpenNewOrder}
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
          rowNumberOffset={(currentPage - 1) * itemsPerPage}
          onRowClick={(order) => navigate(`edit/${order.id}`)}
        />

        {/* Pagination */}
        {!isLoading && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-primarydark/60 dark:bg-primarydark/60 sm:px-5">
            <Pagination
              totalItems={total}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setPage}
              onItemsPerPageChange={setLimit}
              className="pt-0"
            />
          </div>
        )}
      </div>

      <PopupSelect<MarketOption>
        isOpen={showMarketSelect}
        onClose={() => setShowMarketSelect(false)}
        title={t("selectMarket")}
        description={t("marketModalSubtitle")}
        data={markets}
        onSelect={handleSelectMarket}
        keyExtractor={(item) => item.id}
        searchKeys={["name", "phone_number", "phone"]}
        icon={<BookMarked />}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancel", { ns: "common" })}
        labelKey="name"
        secondaryLabelKey="phone_number"
        placeholder={t("searchMarket")}
        className={isMarketsLoading ? "pointer-events-none opacity-90" : ""}
      />
    </div>
  );
};

export default memo(Orders);
