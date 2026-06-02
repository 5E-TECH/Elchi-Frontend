import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookMarked, ListOrdered, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { message } from "antd";
import Button from "../../shared/components/button";
import HeaderName from "../../shared/components/headerName";
import { useOrders } from "../../entities/order/api/orderApi";
import { useOrders as useOrderActions } from "../../entities/orders";
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
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { exportOrdersToExcel } from "./lib/exportOrdersToExcel";
import { getUserBranchType } from "../../widgets/Sidebar/model/menuConfig";
import { isInactiveMarketStatus } from "../../shared/lib/marketStatus";
import PageContainer from "../../shared/ui/PageContainer";
import SellModal from "./list/courier/list/SellModal";
import CancelModal from "./list/courier/list/CancelModal";

const LIMIT = 10;
const EXPORT_PAGE_SIZE = 100;
const MANAGER_TABLE_ACTION_BRANCH_TYPES = new Set(["HYBRID", "PICKUP"]);
const TABLE_ACTION_STATUSES = new Set<OrderStatus>(["waiting", "on the road", "new", "received"]);
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

const extractOrderItems = (payload: unknown): OrderListItem[] => {
  const response = payload as
    | OrderListItem[]
    | {
      data?: OrderListItem[] | { items?: OrderListItem[] };
      items?: OrderListItem[];
    };

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.items)) {
    return response.data.items;
  }
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

const extractOrderTotal = (payload: unknown): number | null => {
  const response = payload as
    | {
      total?: unknown;
      meta?: { total?: unknown };
      pagination?: { total?: unknown };
      data?: { total?: unknown; meta?: { total?: unknown }; pagination?: { total?: unknown } };
    }
    | undefined;

  return toPositiveNumber(
    response?.total ??
    response?.meta?.total ??
    response?.pagination?.total ??
    response?.data?.total ??
    response?.data?.meta?.total ??
    response?.data?.pagination?.total,
  );
};


// ── Main component ─────────────────────────────────────────────────────────
const Orders = () => {
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const { getOrders } = useOrders();
  const { SellOrder, PartlySellOrder, CancelOrder } = useOrderActions();
  const { getMarkets } = useMarkets();
  const { getAllParams } = useQueryParams();
  const [showMarketSelect, setShowMarketSelect] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sellOrder, setSellOrder] = useState<OrderListItem | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OrderListItem | null>(null);

  const role = useSelector((state: RootState) => state.role.role);
  const currentUser = useSelector((state: RootState) => state.user.user);
  const branchType = getUserBranchType(currentUser);
  const canCreateOrder = !(role === "manager" && branchType === "REGIONAL");
  const canUseManagerTableActions =
    role === "manager" && Boolean(branchType && MANAGER_TABLE_ACTION_BRANCH_TYPES.has(branchType));
  const canFilterByBranch = role === "admin" || role === "superadmin";


  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "orders",
    defaultLimit: LIMIT,
  });
  const previousFiltersKeyRef = useRef("");

  // URL params
  const urlParams = getAllParams();
  const urlMarketId = urlParams[ORDER_FILTER_KEYS.marketId] ?? "";
  const urlBranchId = urlParams[ORDER_FILTER_KEYS.branchId] ?? "";
  const urlRegionId = urlParams[ORDER_FILTER_KEYS.regionId] ?? "";
  const urlDistrictId = urlParams[ORDER_FILTER_KEYS.districtId] ?? "";
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

      if (canFilterByBranch) {
        const branchId = urlBranchId;
        if (branchId) params.branch_id = String(branchId);
      }
    }

    if (role === "manager") {
      const districtId = urlDistrictId;
      if (districtId) params.district_id = String(districtId);
    } else {
      // Viloyat / Region
      const regionId = urlRegionId;
      if (regionId) params.region_id = String(regionId);
    }

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
    canFilterByBranch,
    urlMarketId,
    urlRegionId,
    urlDistrictId,
    urlBranchId,
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
        branchId: canFilterByBranch ? urlBranchId : "",
        regionId: role === "manager" ? "" : urlRegionId,
        districtId: role === "manager" ? urlDistrictId : "",
        courierId: role !== "market" ? urlCourierId : "",
        status: Array.isArray(status) ? status.join(",") : status,
        dateFrom: urlDateFrom,
        dateTo: urlDateTo,
        search: urlSearch,
      });
    },
    [
      role,
      canFilterByBranch,
      urlMarketId,
      urlRegionId,
      urlDistrictId,
      urlBranchId,
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
    { status: "active", limit: 100 },
    showMarketSelect,
  );

  const markets = useMemo<MarketOption[]>(() => {
    const payload = marketsResponse as
      | { data?: { items?: MarketOption[] } }
      | { data?: MarketOption[] }
      | MarketOption[]
      | undefined;

    if (Array.isArray(payload)) {
      return payload.filter((market) => !isInactiveMarketStatus(market.status));
    }

    if (Array.isArray(payload?.data)) {
      return payload.data.filter((market) => !isInactiveMarketStatus(market.status));
    }

    if (Array.isArray(payload?.data?.items)) {
      return payload.data.items.filter((market) => !isInactiveMarketStatus(market.status));
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
    if (!canCreateOrder) return;

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

  const canUseOrderActions = useCallback(
    (order: OrderListItem) =>
      canUseManagerTableActions && TABLE_ACTION_STATUSES.has(order.status),
    [canUseManagerTableActions],
  );

  const selectedActionOrder = sellOrder ?? cancelOrder;
  const selectedActionModalOrder = useMemo(() => {
    if (!selectedActionOrder) return null;

    const orderWithProducts = selectedActionOrder as OrderListItem & {
      items?: Array<
        OrderListItem["items"][number] & {
          product?: { id?: string; name?: string; image_url?: string | null } | null;
        }
      >;
    };

    return {
      id: selectedActionOrder.id,
      created_at: selectedActionOrder.createdAt,
      status: selectedActionOrder.status,
      total_price: selectedActionOrder.total_price,
      where_deliver: selectedActionOrder.where_deliver,
      product_quantity: selectedActionOrder.product_quantity,
      market: { name: selectedActionOrder.market?.name ?? "—" },
      customer: {
        name: selectedActionOrder.customer?.name ?? "—",
        phone_number: selectedActionOrder.customer?.phone_number ?? "",
      },
      district: { name: selectedActionOrder.district?.name ?? "—" },
      region: { name: selectedActionOrder.district?.region?.name ?? "—" },
      items: (orderWithProducts.items ?? []).map((item) => {
        const orderItem = item as OrderListItem["items"][number] & {
          product?: { id?: string; name?: string; image_url?: string | null } | null;
        };
        const productId = orderItem.product?.id ?? orderItem.product_id;

        return {
          id: orderItem.id,
          quantity: orderItem.quantity,
          product: {
            id: productId,
            name: orderItem.product?.name ?? `#${productId}`,
            image_url: orderItem.product?.image_url ?? null,
          },
        };
      }),
    };
  }, [selectedActionOrder]);

  const handleSellOrder = useCallback(
    (orderId: string, payload: { comment: string; extraCost: number }) => {
      SellOrder.mutate(
        { orderId, data: payload },
        { onSuccess: () => setSellOrder(null) },
      );
    },
    [SellOrder],
  );

  const handlePartlySellOrder = useCallback(
    (
      orderId: string,
      payload: {
        order_item_info: { product_id: string; quantity: number }[];
        totalPrice: number;
        extraCost: number;
        comment: string;
      },
    ) => {
      PartlySellOrder.mutate(
        { orderId, data: payload },
        { onSuccess: () => setSellOrder(null) },
      );
    },
    [PartlySellOrder],
  );

  const handleCancelOrder = useCallback(
    (
      orderId: string,
      payload: { comment: string; extraCost: number; paidAmount: number },
    ) => {
      CancelOrder.mutate(
        { orderId, data: payload },
        { onSuccess: () => setCancelOrder(null) },
      );
    },
    [CancelOrder],
  );

  const handleExportOrders = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const filters = { ...apiParams };
      delete filters.page;
      delete filters.limit;
      const exportedOrders: OrderListItem[] = [];
      let exportPage = 1;
      let expectedTotal = total;

      while (true) {
        const response = await api.get(API_ENDPOINTS.ORDERS.BASE, {
          params: {
            ...filters,
            page: exportPage,
            limit: EXPORT_PAGE_SIZE,
          },
        });
        const pageItems = extractOrderItems(response.data);
        const responseTotal = extractOrderTotal(response.data);

        if (responseTotal !== null) {
          expectedTotal = responseTotal;
        }

        exportedOrders.push(...pageItems);

        if (
          pageItems.length < EXPORT_PAGE_SIZE ||
          exportedOrders.length >= expectedTotal ||
          exportPage >= 100
        ) {
          break;
        }

        exportPage += 1;
      }

      if (exportedOrders.length === 0) {
        message.warning(t("exportEmpty"));
        return;
      }

      exportOrdersToExcel(exportedOrders, {
        fileName: t("excel.fileName"),
        headers: [
          t("excel.headers.number"),
          t("excel.headers.region"),
          t("excel.headers.district"),
          t("excel.headers.company"),
          t("excel.headers.product"),
          t("excel.headers.phone"),
          t("excel.headers.price"),
          t("excel.headers.courier"),
          t("excel.headers.status"),
          t("excel.headers.date"),
        ],
        statuses: {
          created: t("statusCreated"),
          new: t("statusNew"),
          received: t("statusReceived"),
          "on the road": t("statusOnTheRoad"),
          waiting: t("statusWaiting"),
          sold: t("statusSold"),
          cancelled: t("statusCancelled"),
          paid: t("statusPaid"),
          partly_paid: t("statusPartlyPaid"),
          closed: t("statusClosed"),
        },
      });
      message.success(t("exportSuccess", { count: exportedOrders.length }));
    } catch (error) {
      console.error("Orders export failed:", error);
      message.error(t("exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageContainer className="flex flex-col gap-4 sm:gap-5">

      {/* ── Header ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <HeaderName
            name={t("list")}
            description={t("totalOrdersSummary", { count: total })}
            icon={<ListOrdered />}
          />
          {canCreateOrder && (
            <Button
              label={t("newOrders")}
              icon={<Plus size={16} />}
              onClick={handleOpenNewOrder}
              className="w-full rounded-2xl py-3 text-sm shadow-lg shadow-main/20 sm:w-auto sm:rounded-xl sm:py-2.5"
            />
          )}
        </div>
      </div>

      {/* ── Filters + Table ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm flex flex-col gap-4 p-3 sm:p-4 lg:p-5">

        {/* Filters */}
        <OrderFilters
          onExport={handleExportOrders}
          isExporting={isExporting}
        />

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-primarydark/60" />

        {/* Table */}
        <OrdersTable
          data={items}
          isLoading={isLoading}
          rowNumberOffset={(currentPage - 1) * itemsPerPage}
          onRowClick={(order) => navigate(`edit/${order.id}`)}
          onCreateOrder={canCreateOrder ? handleOpenNewOrder : undefined}
          canUseOrderActions={canUseOrderActions}
          onSellOrder={canUseManagerTableActions ? setSellOrder : undefined}
          onCancelOrder={canUseManagerTableActions ? setCancelOrder : undefined}
          isOrderActionPending={
            SellOrder.isPending || PartlySellOrder.isPending || CancelOrder.isPending
          }
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
      <SellModal
        order={sellOrder ? selectedActionModalOrder : null}
        open={!!sellOrder}
        onClose={() => setSellOrder(null)}
        onSell={handleSellOrder}
        onPartlySell={handlePartlySellOrder}
        isLoading={SellOrder.isPending || PartlySellOrder.isPending}
      />
      <CancelModal
        order={cancelOrder ? selectedActionModalOrder : null}
        open={!!cancelOrder}
        onClose={() => setCancelOrder(null)}
        onCancel={handleCancelOrder}
        isLoading={CancelOrder.isPending}
      />
    </PageContainer>
  );
};

export default memo(Orders);
