// dizayn-v2: superadmin-orders-list, admin-orders-list, registrator-orders-list, market-orders-list, manager-orders-list-all, manager-orders-list-pending, manager-orders-list-cancelled
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Info, Plus, Send } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useOrders } from "../../entities/order/api/orderApi";
import { useOrders as useOrderActions } from "../../entities/orders";
import {
  pollWhileApprovalPending,
  resolveOrderActionResponse,
} from "../../entities/orders/extraCostApproval";
import type { OrderListItem, OrderListParams } from "../../entities/order/types/order";
import OrderFilters from "./list/OrderFilters";
import {
  buildOrderListParams,
  isDeliveryType,
  LEGACY_DATE_FROM_KEY,
  LEGACY_DATE_TO_KEY,
  LEGACY_ORDER_STATUS_URL_KEY,
  matchOrderStatusTab,
  normalizeOrderSearch,
  ORDER_FILTER_KEYS,
  ORDER_LIST_LIMITS,
  ORDER_STATUS_TABS,
  ORDER_STATUS_URL_KEY,
  parseStatusValues,
  sanitizeDayParam,
  type OrderFilterValues,
  type OrderStatusTabId,
} from "./list/orderFilterModel";
import OrdersTable from "./list/OrdersTable";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import type { RootState } from "../../app/config/store";
import { canCreateOrders } from "../../app/lib/access";
import CourierOrders from "./list/courier/index";
import { scrollShellContentToTop, usePagination } from "../../shared/lib/usePagination";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { getUserBranchType } from "../../widgets/Sidebar/model/menuConfig";
import SellModal from "./list/courier/list/SellModal";
import CancelModal from "./list/courier/list/CancelModal";
import RollbackOrderDialog from "./list/courier/list/RollbackOrderDialog";
import { notifyOrderActionDone, type ActionOrder } from "./list/courier/list/orderActionModel";
import { resetFilters, setFilterValue } from "../../shared/model/filterSlice";
import { clearAllSearch } from "../../shared/model/searchSlice";
import { getOrderItemName } from "../../shared/lib/orderItemName";
import { useOrderQrScanner } from "../../shared/lib/useOrderQrScanner";
import { fetchScanDetail, getBackendErrorMessage } from "../scan/lib/scanResource";
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import { orderByRecent, scanNotify, useRecentScans } from "../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../shared/lib/scanner/scanTargets";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { getActionErrorMessage } from "../../shared/lib/actionError";
import { isCourierHeldOrder } from "../../entities/orders/custody";
import type { CancelOrderPayload } from "../../entities/orders/cancelReason";
import { getSellPaymentStatus, SELL_PAYMENT_NOTICE_KEYS, type SellOrderPayload } from "../../entities/orders/sellPayment";
import { notify } from "../../shared/lib/notify";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import { getExportErrorMessage, getFileNameFromDisposition, saveBlob, XLSX_MIME } from "../../shared/lib/exportFile";
import { toISODate } from "../../shared/lib/dateRange";
import { isNetworkFailure } from "../../auth/networkError";
import {
  Button,
  buttonClasses,
  Card,
  PageHeader,
  Pagination,
  Skeleton,
  Tabs,
  type DataTableSort,
  type TabItem,
} from "../../shared/ui/primitives";

/** Eksport natijasi xabari bitta: yangi natija eskisining o'rnini oladi (xWsCAA5N). */
const EXPORT_TOAST_ID = "orders-export";

const LIMIT = 10;
const ORDER_SORT_BY_KEY = "orderSortBy";
const ORDER_SORT_DIR_KEY = "orderSortDir";
// Jadval ustuni -> GET /orders `sort_by` (backend oq ro'yxati). Boshqa ustun
// bo'yicha server saralay olmaydi.
const ORDER_SORT_BY_FIELD: Record<string, NonNullable<OrderListParams["sort_by"]>> = {
  createdAt: "created_at",
  total_price: "total_price",
  status: "status",
};
const MANAGER_TABLE_ACTION_BRANCH_TYPES = new Set(["HYBRID", "REGIONAL"]);
// Bekor qilinganlarni HQ'ga yuborish (tanlov + QR skaner) — eski menejer tablari bo'lgan filiallar.
const MANAGER_BULK_SEND_BRANCH_TYPES = new Set(["HYBRID", "REGIONAL"]);
const TABLE_ACTION_STATUSES = new Set(["waiting", "on the road", "new", "received"]);
const TABLE_ROLLBACK_STATUSES = new Set(["sold", "cancelled"]);
const CANCELLED_STATUSES = new Set(["cancelled", "cancelled (sent)"]);
const isUnsentCancelledOrder = (order: OrderListItem) => order.status === "cancelled";
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const normalizeMatchText = (value: unknown) => toText(value).toLowerCase();

const unwrapScannedOrder = (payload: unknown) => {
  const source = asRecord(payload);
  const data = asRecord(source.data ?? source);
  const nestedData = asRecord(data.data ?? data);
  return asRecord(nestedData.order ?? data.order ?? nestedData);
};

const addOrderIdentifiers = (target: Set<string>, value: unknown) => {
  const record = asRecord(value);
  [
    "id",
    "qr_code_token",
    "qrCodeToken",
    "token",
    "order_token",
    "orderToken",
    "parent_order_id",
    "parentOrderId",
    "original_order_id",
    "originalOrderId",
    "source_order_id",
    "sourceOrderId",
    "split_from_order_id",
    "splitFromOrderId",
    "cancelled_from_order_id",
    "cancelledFromOrderId",
    "partly_sold_order_id",
    "partlySoldOrderId",
    "root_order_id",
    "rootOrderId",
    "base_order_id",
    "baseOrderId",
  ].forEach((key) => {
    const text = normalizeMatchText(record[key]);
    if (text) target.add(text);
  });

  [
    "order",
    "parent_order",
    "parentOrder",
    "original_order",
    "originalOrder",
    "source_order",
    "sourceOrder",
    "split_from_order",
    "splitFromOrder",
    "cancelled_from_order",
    "cancelledFromOrder",
  ].forEach((key) => {
    const nested = asRecord(record[key]);
    ["id", "qr_code_token", "qrCodeToken", "token"].forEach((nestedKey) => {
      const text = normalizeMatchText(nested[nestedKey]);
      if (text) target.add(text);
    });
  });
};

const getOrderIdentifiers = (value: unknown) => {
  const identifiers = new Set<string>();
  addOrderIdentifiers(identifiers, value);
  return identifiers;
};

const getComparableOrderInfo = (value: unknown) => {
  const order = asRecord(value);
  const customer = asRecord(order.customer);
  const market = asRecord(order.market);
  const district = asRecord(order.district);

  return {
    customerId: normalizeMatchText(order.customer_id ?? order.customerId ?? customer.id),
    name: normalizeMatchText(
      customer.name ??
        customer.full_name ??
        customer.fullName ??
        order.customer_name ??
        order.customerName ??
        order.name,
    ),
    phone: normalizeMatchText(
      customer.phone_number ??
        customer.phoneNumber ??
        customer.phone ??
        order.customer_phone ??
        order.customerPhone ??
        order.phone_number ??
        order.phone,
    ),
    marketId: normalizeMatchText(order.market_id ?? order.marketId ?? market.id),
    marketName: normalizeMatchText(market.name),
    districtId: normalizeMatchText(order.district_id ?? order.districtId ?? district.id),
    districtName: normalizeMatchText(district.name),
  };
};

const isSameCustomerMarketOrder = (left: unknown, right: unknown) => {
  const a = getComparableOrderInfo(left);
  const b = getComparableOrderInfo(right);
  const sameCustomer =
    Boolean(a.customerId && a.customerId === b.customerId) ||
    Boolean(a.phone && a.phone === b.phone) ||
    Boolean(a.name && a.name === b.name);
  const sameMarket = Boolean(a.marketId && a.marketId === b.marketId) || Boolean(a.marketName && a.marketName === b.marketName);
  const sameDistrict =
    !a.districtId && !a.districtName && !b.districtId && !b.districtName
      ? true
      : Boolean(a.districtId && a.districtId === b.districtId) ||
        Boolean(a.districtName && a.districtName === b.districtName);

  return sameCustomer && sameMarket && sameDistrict;
};

/**
 * Faqat bekor qilinganlar (bitta yoki ikkala holat) — «Bekor qilingan» tabi. Eski menejer tabi ham shunday
 * edi: filtrdan faqat «Bekor qilingan» tanlansa ham HQ'ga yuborish ochiq.
 */
const isCancelledOnly = (statuses: readonly string[]) =>
  statuses.length > 0 && statuses.every((status) => CANCELLED_STATUSES.has(status));

/** URL holati → tanlangan tab; Holat filtridan boshqa to'plam — `"custom"` (birorta tab tanlanmaydi). */
const getActiveStatusTab = (statuses: readonly string[]): OrderStatusTabId | "custom" => {
  if (statuses.length === 0) return "all";
  if (isCancelledOnly(statuses)) return "cancelled";
  return matchOrderStatusTab(statuses) ?? "custom";
};

const TAB_HINT_KEYS: Partial<Record<OrderStatusTabId, string>> = {
  paid: "ordersList.tabs.paidHint",
  cancelled: "ordersList.tabs.cancelledHint",
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

// ── Main component ─────────────────────────────────────────────────────────
const Orders = () => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { useGetOrders } = useOrders();
  const { SellOrder, PartlySellOrder, CancelOrder, RollbackOrder, SendToPost } = useOrderActions();
  const { getAllParams, setMultipleParams } = useQueryParams();
  const [isExporting, setIsExporting] = useState(false);
  const exportingRef = useRef(false);
  const [sellOrder, setSellOrder] = useState<OrderListItem | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OrderListItem | null>(null);
  // Market tasdig'iga tushgan amal: modal yopilmaydi, holat ko'rsatiladi.
  const [approvalOrderId, setApprovalOrderId] = useState<string | null>(null);
  const [rollbackOrder, setRollbackOrder] = useState<OrderListItem | null>(null);
  const [selectedCancelledIds, setSelectedCancelledIds] = useState<Set<string>>(new Set());

  const role = useSelector((state: RootState) => state.role.role);
  const currentUser = useSelector((state: RootState) => state.user.user);
  const canCreate = useSelector(canCreateOrders);
  const branchType = getUserBranchType(currentUser);
  // Menejerning sotish/bekor qilish (va shu oynadagi qisman sotish) hamda
  // qaytarish amallari endi per-menejer `can_sell_cancel` bayrog'iga ham bog'liq
  // (superadmin/admin yoqadi). Backend amalni baribir tekshiradi — bu faqat
  // tugmalarni izchil yashirish uchun. Redux `User` tipida bu maydon yo'q, shuning
  // uchun cast bilan o'qiladi (branch_type kabi).
  const canSellCancelEnabled = Boolean(
    (currentUser as { can_sell_cancel?: boolean } | null | undefined)?.can_sell_cancel,
  );
  const canUseManagerTableActions =
    role === "manager" &&
    Boolean(branchType && MANAGER_TABLE_ACTION_BRANCH_TYPES.has(branchType)) &&
    canSellCancelEnabled;
  const canUseManagerBulkSend =
    role === "manager" && Boolean(branchType && MANAGER_BULK_SEND_BRANCH_TYPES.has(branchType));

  // `?limit=5000` kabi backend qabul qilmaydigan qiymat e'tiborsiz (D-08) — aks holda 400 va o'tmaydigan xato.
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "orders",
    defaultLimit: LIMIT,
    allowedLimits: ORDER_LIST_LIMITS,
  });
  // Sahifa / sahifadagi qatorlar soni almashganda ro'yxat boshidan ko'rinsin (D-03, telefonda pastda qolib ketardi).
  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      scrollShellContentToTop();
    },
    [setPage],
  );
  const handlePageSizeChange = useCallback(
    (nextLimit: number) => {
      setLimit(nextLimit);
      scrollShellContentToTop();
    },
    [setLimit],
  );
  const previousFiltersKeyRef = useRef("");

  // URL params
  const urlParams = getAllParams();
  const urlMarketId = urlParams[ORDER_FILTER_KEYS.marketId] ?? "";
  const urlBranchId = urlParams[ORDER_FILTER_KEYS.branchId] ?? "";
  const urlRegionId = urlParams[ORDER_FILTER_KEYS.regionId] ?? "";
  const urlDistrictId = urlParams[ORDER_FILTER_KEYS.districtId] ?? "";
  const urlCourierId = urlParams[ORDER_FILTER_KEYS.courierId] ?? "";
  const urlStatusRaw = urlParams[ORDER_STATUS_URL_KEY] ?? urlParams[LEGACY_ORDER_STATUS_URL_KEY] ?? "";
  const urlDeliveryType = urlParams[ORDER_FILTER_KEYS.deliveryType] ?? "";
  // Noto'g'ri sana (`?startDay=falonchi`) va bo'sh / «№53» qidiruv API'ga xom ketmaydi (D-08, D-11).
  const urlDateFrom = sanitizeDayParam(urlParams[ORDER_FILTER_KEYS.dateFrom] ?? urlParams[LEGACY_DATE_FROM_KEY]);
  const urlDateTo = sanitizeDayParam(urlParams[ORDER_FILTER_KEYS.dateTo] ?? urlParams[LEGACY_DATE_TO_KEY]);
  const urlSearch = normalizeOrderSearch(urlParams[ORDER_FILTER_KEYS.search]);
  const urlSortBy = urlParams[ORDER_SORT_BY_KEY] ?? "";
  const urlSortDir = urlParams[ORDER_SORT_DIR_KEY] ?? "";
  const sortConfig: DataTableSort | null =
    ORDER_SORT_BY_FIELD[urlSortBy] && (urlSortDir === "asc" || urlSortDir === "desc")
      ? { key: urlSortBy, direction: urlSortDir }
      : null;
  const urlStatuses = useMemo(() => parseStatusValues(urlStatusRaw), [urlStatusRaw]);
  const activeStatusTab = getActiveStatusTab(urlStatuses);

  useEffect(() => {
    if (!urlParams[ORDER_STATUS_URL_KEY] && urlParams[LEGACY_ORDER_STATUS_URL_KEY]) {
      setMultipleParams({
        [ORDER_STATUS_URL_KEY]: urlParams[LEGACY_ORDER_STATUS_URL_KEY],
        [LEGACY_ORDER_STATUS_URL_KEY]: "",
      });
    }
  }, [setMultipleParams, urlParams]);

  // Holat tabi: holat va 1-sahifa bitta URL yangilanishida (ortiqcha so'rov ketmasin).
  const handleStatusTabChange = useCallback(
    (tabId: string) => {
      const tab = ORDER_STATUS_TABS.find((item) => item.id === tabId);
      if (!tab) return;
      setSelectedCancelledIds(new Set());
      dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.status, value: [...tab.statuses] }));
      setMultipleParams({
        [ORDER_STATUS_URL_KEY]: tab.statuses.join(","),
        [LEGACY_ORDER_STATUS_URL_KEY]: "",
        page: "1",
      });
    },
    [dispatch, setMultipleParams],
  );

  const filterValues = useMemo(
    (): OrderFilterValues & { search: string } => ({
      marketId: urlMarketId,
      branchId: urlBranchId,
      regionId: urlRegionId,
      districtId: urlDistrictId,
      courierId: urlCourierId,
      deliveryType: isDeliveryType(urlDeliveryType) ? urlDeliveryType : "",
      statuses: urlStatuses,
      dateFrom: urlDateFrom,
      dateTo: urlDateTo,
      search: urlSearch,
    }),
    [
      urlMarketId,
      urlBranchId,
      urlRegionId,
      urlDistrictId,
      urlCourierId,
      urlDeliveryType,
      urlStatuses,
      urlDateFrom,
      urlDateTo,
      urlSearch,
    ],
  );

  // API parametrlari — telefon filtr varaqasidagi son bilan bir xil qoida (`orderFilterModel`), ustiga saralash.
  const apiParams = useMemo((): OrderListParams => {
    const params = buildOrderListParams(filterValues, role, { page, limit });

    // Saralash serverda — butun ro'yxat bo'yicha.
    const sortBy = ORDER_SORT_BY_FIELD[urlSortBy];
    if (sortBy && (urlSortDir === "asc" || urlSortDir === "desc")) {
      params.sort_by = sortBy;
      params.sort_dir = urlSortDir;
    }

    return params;
  }, [filterValues, role, page, limit, urlSortBy, urlSortDir]);

  // Filtr kaliti: rol bo'yicha qo'llanadigan filtrlar (sahifa va saralashsiz).
  const filtersKey = useMemo(
    () => JSON.stringify({ role, ...buildOrderListParams(filterValues, role, { page: 0, limit: 0 }) }),
    [filterValues, role],
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

  // Saralash o'zgarganda sahifani 1 ga qaytarish — aks holda foydalanuvchi
  // masalan 3-sahifada turib narx bo'yicha saralasa, u yerdagi tasodifiy
  // tartiblangan qatorlarni ko'rib chalg'iydi.
  const sortKey = `${sortConfig?.key ?? ""}:${sortConfig?.direction ?? ""}`;
  const previousSortKeyRef = useRef(sortKey);
  useEffect(() => {
    if (previousSortKeyRef.current === sortKey) {
      return;
    }

    previousSortKeyRef.current = sortKey;
    setPage(1);
  }, [setPage, sortKey]);

  // Saralash va 1-sahifa bitta URL yangilanishida yoziladi — aks holda
  // avval yangi saralash + ESKI sahifa bilan ortiqcha so'rov ketardi.
  const handleSortChange = useCallback(
    (config: DataTableSort | null) => {
      setMultipleParams({
        [ORDER_SORT_BY_KEY]: config?.key ?? "",
        [ORDER_SORT_DIR_KEY]: config?.direction ?? "",
        page: "1",
      });
    },
    [setMultipleParams],
  );

  // Kuryer o'z ro'yxatini (`CourierOrders`) o'zi so'raydi — bu so'rov unga kerak emas.
  const ordersQuery = useGetOrders(apiParams, role !== "courier", (current) =>
    pollWhileApprovalPending(current?.data ?? []),
  );
  const { data, isLoading, isError: isOrdersError, error: ordersError, refetch: refetchOrders } = ordersQuery;

  const rawPagination = (data as { meta?: Record<string, unknown>; pagination?: Record<string, unknown> } | undefined)?.meta
    ?? (data as { pagination?: Record<string, unknown> } | undefined)?.pagination
    ?? {};
  const items = useMemo<OrderListItem[]>(() => data?.data ?? [], [data?.data]);
  const currentPage = toPositiveNumber(data?.page ?? rawPagination.page) ?? page;

  /**
   * RAQAM BO'YICHA ANIQ MOSLIK (hOGoAoq4). Backend qidiruvi raqamni matn
   * sifatida qidiradi va aynan mos buyurtmani tepaga chiqarmaydi: "1"
   * qidirilganda №1 13-sahifada chiqardi. Qidiruv to'liq raqam bo'lsa o'sha
   * buyurtma ALOHIDA olinadi va 1-sahifaning boshiga qo'yiladi (sahifada
   * takrorlanmaydi). Ruxsatni backend tekshiradi: begona buyurtma 403/404 —
   * hech narsa qo'shilmaydi.
   */
  const exactOrderId = /^\d{1,12}$/.test(urlSearch.trim()) ? urlSearch.trim() : "";
  const { data: exactOrder } = useQuery({
    queryKey: ["orders", "exact-number", exactOrderId],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.BY_ID(exactOrderId))
        .then((res) => {
          const body = res.data as { data?: OrderListItem } | OrderListItem | undefined;
          const order = (body && "data" in body ? body.data : body) as OrderListItem | undefined;
          return order && String(order.id) === exactOrderId ? order : null;
        })
        .catch(() => null),
    enabled: Boolean(exactOrderId) && role !== "courier",
    retry: false,
    staleTime: 30_000,
  });
  const pinnedOrderId = exactOrderId && exactOrder && currentPage === 1 ? String(exactOrder.id) : "";
  const tableItems = useMemo<OrderListItem[]>(
    () =>
      pinnedOrderId && exactOrder
        ? [exactOrder, ...items.filter((order) => String(order.id) !== pinnedOrderId)]
        : items,
    [exactOrder, items, pinnedOrderId],
  );
  const itemsPerPage = toPositiveNumber(data?.limit ?? rawPagination.limit) ?? limit;
  const total = toPositiveNumber(data?.total ?? rawPagination.total) ?? items.length;
  const canSendCancelledToHq = canUseManagerBulkSend && activeStatusTab === "cancelled";

  // Sahifa ro'yxat oxiridan tashqarida qolsa (masalan oxirgi sahifadagi yagona buyurtma qaytarildi yoki
  // HQ'ga yuborildi) — «Buyurtmalar topilmadi» va sahifalashsiz qolib ketmasin: oxirgi sahifaga o'tiladi.
  const lastPage = Math.max(1, Math.ceil(total / itemsPerPage));
  const isPlaceholderData = Boolean(ordersQuery.isPlaceholderData);
  useEffect(() => {
    if (role === "courier" || isLoading || isOrdersError || isPlaceholderData) return;
    if (items.length === 0 && total > 0 && page > lastPage) setPage(lastPage);
  }, [isLoading, isOrdersError, isPlaceholderData, items.length, lastPage, page, role, setPage, total]);

  useEffect(() => {
    if (!canSendCancelledToHq) {
      setSelectedCancelledIds((previous) => previous.size > 0 ? new Set() : previous);
      return;
    }

    const selectableIds = new Set(
      items.filter(isUnsentCancelledOrder).map((order) => order.id),
    );
    setSelectedCancelledIds((previous) => {
      const next = new Set([...previous].filter((id) => selectableIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [canSendCancelledToHq, items]);

  const canUseOrderActions = useCallback(
    (order: OrderListItem) =>
      canUseManagerTableActions &&
      (TABLE_ACTION_STATUSES.has(order.status) || TABLE_ROLLBACK_STATUSES.has(order.status)),
    [canUseManagerTableActions],
  );
  // fix3b LC-04: kuryer qo'lidagi buyurtmani kuryerning o'zi sotadi — menejer
  // "Sotish"ni (qisman sotish ham shu oynada) bossa backend 400 qaytaradi
  // ("Bu buyurtma kuryer qo'lida..."). Tugma o'chiq va sababi yozilgan;
  // bekor qilish menejerga ochiq qoladi.
  const canManagerSellOrder = useCallback(
    (order: OrderListItem) => !isCourierHeldOrder(order),
    [],
  );

  const selectedActionOrder = sellOrder ?? cancelOrder;
  const selectedActionModalOrder = useMemo((): ActionOrder | null => {
    if (!selectedActionOrder) return null;

    const orderFlags = selectedActionOrder as OrderListItem & Record<string, unknown>;
    const proofConditions = Array.isArray(selectedActionOrder.market?.expense_proof_conditions)
      ? selectedActionOrder.market.expense_proof_conditions
      : [];
    const sellRequiresMedia = Boolean(
      orderFlags.sell_requires_media ??
      orderFlags.sellRequiresMedia ??
      orderFlags.require_sell_proof ??
      orderFlags.sell_proof_required ??
      proofConditions.includes("sell_any"),
    );
    const cancelRequiresMedia = Boolean(
      orderFlags.cancel_requires_media ??
      orderFlags.cancelRequiresMedia ??
      orderFlags.require_cancel_proof ??
      orderFlags.cancel_proof_required ??
      proofConditions.includes("cancel_any"),
    );

    return {
      id: selectedActionOrder.id,
      status: selectedActionOrder.status,
      total_price: selectedActionOrder.total_price,
      to_be_paid: selectedActionOrder.to_be_paid,
      external_id: (orderFlags.external_id as string | number | null | undefined) ?? null,
      where_deliver: selectedActionOrder.where_deliver,
      market: {
        name: selectedActionOrder.market?.name ?? "—",
        expense_proof_conditions: selectedActionOrder.market?.expense_proof_conditions ?? null,
      },
      customer: {
        name: selectedActionOrder.customer?.name ?? "—",
        phone_number: selectedActionOrder.customer?.phone_number ?? "",
      },
      district: { name: selectedActionOrder.district?.name ?? "—" },
      sell_requires_media: sellRequiresMedia,
      cancel_requires_media: cancelRequiresMedia,
      items: (selectedActionOrder.items ?? []).map((orderItem) => {
        const productId = orderItem.product?.id ?? orderItem.product_id;

        return {
          id: orderItem.id,
          quantity: orderItem.quantity,
          product: {
            /**
             * Hamkor (Partner API) buyurtmalarida mahsulot bizning katalogda
             * yo'q: `product_id` bo'sh, nom `product_name` da matn bo'lib
             * keladi. Bunday holatda `id` UMUMAN yuborilmaydi — avval u
             * `null` bo'lib ketardi va mavjud bo'lmagan mahsulotga havola
             * yasalardi.
             */
            ...(productId ? { id: productId } : {}),
            name: getOrderItemName({ ...orderItem, product_id: productId }, "—"),
            image_url: orderItem.product?.image_url ?? null,
          },
        };
      }),
    };
  }, [selectedActionOrder]);

  const closeSellModal = useCallback(() => {
    setSellOrder(null);
    setApprovalOrderId(null);
  }, []);

  const closeCancelModal = useCallback(() => {
    setCancelOrder(null);
    setApprovalOrderId(null);
  }, []);

  // fix3 FE-ORD-02: menejer jadvalidagi sotish/bekor/qaytarish rad etilsa —
  // sabab ko'rinadi (avval jimgina yutilardi). Oyna ochiq qoladi.
  const notifyActionError = useCallback(
    (error: unknown) => {
      const description = getActionErrorMessage(error, t("orderActionError"));
      if (description) notify.error(description);
    },
    [t],
  );

  const handleSellOrder = useCallback(
    (orderId: string, payload: SellOrderPayload) => {
      const order = sellOrder ?? { id: orderId };
      SellOrder.mutate(
        { orderId, data: payload },
        {
          onSuccess: (response) => {
            // Marketga to'lov yozilgan bo'lsa — natija (to'liq / qisman) o'sha xabarning o'zi.
            const paymentStatus = getSellPaymentStatus(response);
            resolveOrderActionResponse(response, {
              order,
              action: "sell",
              extraCost: payload.extraCost,
              onCompleted: () => {
                closeSellModal();
                if (!paymentStatus) notifyOrderActionDone("sell", sellOrder);
              },
              onApprovalRequested: () => setApprovalOrderId(orderId),
            });
            if (paymentStatus) notify.success(t(SELL_PAYMENT_NOTICE_KEYS[paymentStatus]));
          },
          onError: notifyActionError,
        },
      );
    },
    [SellOrder, closeSellModal, notifyActionError, sellOrder, t],
  );

  const handlePartlySellOrder = useCallback(
    (
      orderId: string,
      payload: {
        order_item_info: { order_item_id: string; product_id?: string; quantity: number }[];
        totalPrice: number;
        extraCost: number;
        comment: string;
        proof?: File;
      },
    ) => {
      const order = sellOrder ?? { id: orderId };
      PartlySellOrder.mutate(
        { orderId, data: payload },
        {
          onSuccess: (response) =>
            resolveOrderActionResponse(response, {
              order,
              action: "partly_sell",
              extraCost: payload.extraCost,
              onCompleted: () => {
                closeSellModal();
                notifyOrderActionDone("partly_sell", sellOrder);
              },
              onApprovalRequested: () => setApprovalOrderId(orderId),
            }),
          onError: notifyActionError,
        },
      );
    },
    [PartlySellOrder, closeSellModal, notifyActionError, sellOrder],
  );

  const handleCancelOrder = useCallback(
    (
      orderId: string,
      payload: CancelOrderPayload,
    ) => {
      const order = cancelOrder ?? { id: orderId };
      CancelOrder.mutate(
        { orderId, data: payload },
        {
          onSuccess: (response) =>
            resolveOrderActionResponse(response, {
              order,
              action: "cancel",
              extraCost: payload.extraCost,
              onCompleted: () => {
                closeCancelModal();
                notifyOrderActionDone("cancel", cancelOrder);
              },
              onApprovalRequested: () => setApprovalOrderId(orderId),
            }),
          onError: notifyActionError,
        },
      );
    },
    [CancelOrder, cancelOrder, closeCancelModal, notifyActionError],
  );

  const handleRollbackOrder = useCallback(() => {
    if (!rollbackOrder) return;

    const order = rollbackOrder;
    RollbackOrder.mutate(order.id, {
      onSuccess: () => {
        setRollbackOrder(null);
        notifyOrderActionDone("rollback", order);
      },
      onError: notifyActionError,
    });
  }, [RollbackOrder, notifyActionError, rollbackOrder]);

  const handleSelectCancelled = useCallback((id: string, checked: boolean) => {
    setSelectedCancelledIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Kamera ro'yxati (Trello v1eLN2tV 2-bosqich): skan tartibi (`order:<id>` / `missing:<kod>`) va ro'yxatda yo'q kodlar.
  const { recent: recentScanKeys, touch: touchRecentScan } = useRecentScans();
  const [rejectedScans, setRejectedScans] = useState<{ code: string; reason: string }[]>([]);

  /** Rad etilgan kod — kamera ro'yxatida «<kod> · Rad etildi · <sabab>» (tanlovga kirmaydi). */
  const rejectScannedCode = useCallback((code: string, reason: string, message: string) => {
    if (code) {
      setRejectedScans((previous) => [...previous.filter((item) => item.code !== code), { code, reason }]);
      touchRecentScan(`missing:${code}`);
    }
    void playScanFeedback("missing", message);
  }, [touchRecentScan]);

  const selectScannedCancelledOrder = useCallback((order: OrderListItem) => {
    const name = order.customer?.name ?? `№${order.id}`;
    if (!isUnsentCancelledOrder(order)) {
      scanNotify.warning(t("scanNotFoundTitle"), { description: t("scanNotFoundDescription") });
      rejectScannedCode(`№${order.id}`, t("ordersList.cameraReasonNotSendable"), t("scanNotFoundDescription"));
      return;
    }

    if (selectedCancelledIds.has(order.id)) {
      scanNotify.warning(t("scanAlreadySelectedTitle"), { description: t("scanAlreadySelectedDescription", { name }) });
      void playScanFeedback("duplicate", t("scanAlreadySelectedDescription", { name }));
      return;
    }

    setSelectedCancelledIds((previous) => {
      const next = new Set(previous);
      next.add(order.id);
      return next;
    });
    touchRecentScan(`order:${order.id}`);
    scanNotify.success(t("scanSelectedTitle"), {
      description: t("ordersList.scanSelected", { name: order.customer?.name ?? "—", id: order.id }),
    });
    void playScanFeedback("success", t("ordersList.cameraSelected", { id: order.id }));
  }, [rejectScannedCode, selectedCancelledIds, t, touchRecentScan]);

  const handleMissingScannedCancelledOrder = useCallback(async (rawValue: string) => {
    try {
      const detail = await fetchScanDetail(rawValue);
      const scannedOrder = detail.type === "order" ? unwrapScannedOrder(detail.data) : {};
      const scannedIdentifiers = getOrderIdentifiers(scannedOrder);
      const matchedByIdentifier = items.find((order) => {
        const orderIdentifiers = getOrderIdentifiers(order);
        return [...scannedIdentifiers].some((identifier) => orderIdentifiers.has(identifier));
      });
      const comparableMatches = matchedByIdentifier
        ? []
        : items.filter((order) => isUnsentCancelledOrder(order) && isSameCustomerMarketOrder(scannedOrder, order));
      const matchedOrder = matchedByIdentifier ?? (comparableMatches.length === 1 ? comparableMatches[0] : undefined);

      if (matchedOrder) {
        selectScannedCancelledOrder(matchedOrder);
        return;
      }

      scanNotify.error(t("scanNotFoundTitle"), { description: t("scanNotFoundDescription") });
      rejectScannedCode(
        extractScannerToken(rawValue) ?? rawValue.trim(),
        t("ordersList.cameraReasonMissing"),
        t("scanNotFoundDescription"),
      );
    } catch (error) {
      const message = getBackendErrorMessage(error) ?? t("scanNotFoundDescription");
      scanNotify.error(t("scanNotFoundTitle"), { description: message });
      void playScanFeedback("error", message);
    }
  }, [items, rejectScannedCode, selectScannedCancelledOrder, t]);

  // KAMERA (Trello v1eLN2tV 2-bosqich; maket yo'q — eng yaqini `manager-batches-detail-send-camera`): faqat
  // HYBRID/REGIONAL menejerning «Bekor qilingan» tabida. Sahifada kamera tugmasi yo'q — markaziy «Skaner» /
  // «Skanerlash» shu maqsadni ochadi; kamera skani USB bilan bir yo'l (faqat tanlaydi), yuborish — sahifadagi
  // «HQ'ga yuborish».
  const unsentCancelledCount = useMemo(() => items.filter(isUnsentCancelledOrder).length, [items]);
  const cancelledCameraList = useMemo<ScanTargetListItem[]>(() => {
    const selectedItems = items
      .filter((order) => selectedCancelledIds.has(order.id))
      .map<ScanTargetListItem>((order) => ({
        key: `order:${order.id}`,
        title: [`№${order.id}`, order.customer?.name?.trim()].filter(Boolean).join(" · "),
        subtitle: [order.district?.name?.trim(), formatMoneyLocalized(Number(order.total_price) || 0, { language })]
          .filter(Boolean)
          .join(" · "),
        tone: "success",
        onUndo: () => handleSelectCancelled(order.id, false),
      }));
    const rejectedItems = rejectedScans.map<ScanTargetListItem>(({ code, reason }) => ({
      key: `missing:${code}`,
      title: code,
      subtitle: t("ordersList.cameraRejected", { reason }),
      tone: "danger",
    }));
    return orderByRecent([...selectedItems, ...rejectedItems], (item) => item.key, recentScanKeys);
  }, [handleSelectCancelled, items, language, recentScanKeys, rejectedScans, selectedCancelledIds, t]);

  useOrderQrScanner({
    orders: items,
    enabled: canSendCancelledToHq,
    paused: isLoading || SendToPost.isPending,
    onMatch: selectScannedCancelledOrder,
    onMissing: (rawValue) => {
      void handleMissingScannedCancelledOrder(rawValue);
    },
    camera: {
      id: "orders:cancelled-to-hq",
      title: t("ordersList.sendToHq"),
      context: t("ordersList.cameraContext", { value: formatNumberLocalized(unsentCancelledCount, { language }) }),
      note: { title: t("ordersList.cameraNoteTitle"), text: t("ordersList.cameraNoteText") },
      progress: { done: selectedCancelledIds.size, total: unsentCancelledCount, label: t("ordersList.cameraMeter") },
      list: cancelledCameraList,
      listTitle: t("ordersList.cameraListTitle"),
      finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
    },
  });

  const handleSelectAllCancelled = useCallback((checked: boolean) => {
    setSelectedCancelledIds(
      checked
        ? new Set(items.filter(isUnsentCancelledOrder).map((order) => order.id))
        : new Set(),
    );
  }, [items]);

  const handleSendCancelledToHq = useCallback(() => {
    if (selectedCancelledIds.size === 0 || SendToPost.isPending) return;

    SendToPost.mutate(Array.from(selectedCancelledIds), {
      onSuccess: () => {
        setSelectedCancelledIds(new Set());
        notify.success(t("sentToHqSuccess"));
      },
      onError: (error: unknown) => {
        const backendMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        notify.error(backendMessage ?? t("sendToHqError"));
      },
    });
  }, [SendToPost, selectedCancelledIds, t]);

  // Bo'sh ro'yxatda «Filtrlarni tozalash»: holat tabi (navigatsiya) qoladi, Holat filtridan tanlangan to'plam
  // (`custom`) esa tozalanadi.
  const hasActiveFilters =
    Boolean(
      urlMarketId ||
        urlBranchId ||
        urlRegionId ||
        urlDistrictId ||
        urlCourierId ||
        urlDeliveryType ||
        urlDateFrom ||
        urlDateTo ||
        urlSearch,
    ) || activeStatusTab === "custom";

  const handleClearFilters = useCallback(() => {
    dispatch(resetFilters());
    dispatch(clearAllSearch());
    setMultipleParams({
      [ORDER_FILTER_KEYS.marketId]: "",
      [ORDER_FILTER_KEYS.branchId]: "",
      [ORDER_FILTER_KEYS.regionId]: "",
      [ORDER_FILTER_KEYS.districtId]: "",
      [ORDER_FILTER_KEYS.courierId]: "",
      [ORDER_FILTER_KEYS.deliveryType]: "",
      [ORDER_FILTER_KEYS.dateFrom]: "",
      [ORDER_FILTER_KEYS.dateTo]: "",
      [ORDER_FILTER_KEYS.search]: "",
      [LEGACY_DATE_FROM_KEY]: "",
      [LEGACY_DATE_TO_KEY]: "",
      ...(activeStatusTab === "custom" ? { [ORDER_STATUS_URL_KEY]: "", [LEGACY_ORDER_STATUS_URL_KEY]: "" } : {}),
      page: "1",
    });
  }, [activeStatusTab, dispatch, setMultipleParams]);

  /**
   * Excel eksporti (xWsCAA5N): joriy filtrlar bilan BITTA `GET orders/export/excel` — server haqiqiy
   * .xlsx beradi («Jami» qatori, 50 000 gacha). Nom — `Content-Disposition` dan. Chegaradan oshsa
   * (`X-Export-Truncated`) — ogohlantirish; xato javobi blob ichida JSON — backend matni ko'rsatiladi.
   */
  const handleExportOrders = async () => {
    // Ref, holat emas: xato xabaridagi «Qayta urinish» eski render'dagi funksiyani chaqiradi — u yerda
    // `isExporting` hali `false`, ikkinchi so'rov va ikkinchi fayl ketardi.
    if (exportingRef.current) return;
    exportingRef.current = true;
    setIsExporting(true);
    // Avvalgi natija xabari (masalan, «Qayta urinish» li xato) yangi urinishda qolmaydi.
    notify.dismiss(EXPORT_TOAST_ID);

    try {
      // `GET /orders` filtrlari aynan shunday; sahifalash yo'q — filtrga mos hamma qator.
      const filters: Record<string, unknown> = { ...apiParams };
      delete filters.page;
      delete filters.limit;
      const response = await api.get(API_ENDPOINTS.ORDERS.EXPORT_EXCEL, {
        params: filters,
        responseType: "blob",
        timeout: LONG_REQUEST_TIMEOUT_MS,
      });
      const headers = (response.headers ?? {}) as Record<string, unknown>;
      const exportTotal = Number(headers["x-export-total"]);
      if (headers["x-export-total"] !== undefined && exportTotal === 0) {
        notify.warning(t("exportEmpty"), { id: EXPORT_TOAST_ID });
        return;
      }

      const blob = response.data instanceof Blob ? response.data : new Blob([response.data as BlobPart], { type: XLSX_MIME });
      saveBlob(
        blob,
        getFileNameFromDisposition(headers["content-disposition"]) ??
          `${t("excel.fileName")}_${toISODate(new Date())}.xlsx`,
      );

      const totalText = formatNumberLocalized(exportTotal, { language });
      if (String(headers["x-export-truncated"]) === "true") {
        notify.warning(t("exportTruncatedTitle"), {
          id: EXPORT_TOAST_ID,
          description: t("exportTruncated", {
            count: formatNumberLocalized(Number(headers["x-export-limit"]), { language }),
            total: totalText,
          }),
        });
        return;
      }
      notify.success(t("exportSuccessTitle"), {
        id: EXPORT_TOAST_ID,
        ...(Number.isFinite(exportTotal) ? { description: t("exportSuccess", { count: totalText }) } : {}),
      });
    } catch (error) {
      // Javob umuman kelmadi (internet yo'q, 120 s tugadi) — global qatlam «Internet aloqasi yo'q» /
      // «Server javob bermadi» ni o'zi chiqaradi; bir xil ikkinchi xabar ko'rsatilmaydi.
      if (isNetworkFailure(error)) return;
      // 5xx — taxtadagi matn («Server javob bermadi…»); 4xx (ruxsat, filtr xatosi) — backend sababi.
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      const backendMessage = status && status < 500 ? await getExportErrorMessage(error) : undefined;
      notify.error(t("exportErrorTitle"), {
        id: EXPORT_TOAST_ID,
        description: backendMessage ?? t("exportError"),
        action: { label: t("states.retry", { ns: "ui" }), onClick: () => void handleExportOrders() },
      });
    } finally {
      exportingRef.current = false;
      setIsExporting(false);
    }
  };

  const statusTabs = useMemo<TabItem[]>(
    () =>
      ORDER_STATUS_TABS.map((tab) => ({
        value: tab.id,
        label: t(`ordersList.tabs.${tab.id}`),
        title: TAB_HINT_KEYS[tab.id] ? t(TAB_HINT_KEYS[tab.id] as string) : undefined,
      })),
    [t],
  );

  if (role === "courier") {
    return <CourierOrders />;
  }

  const listLabel =
    activeStatusTab === "waiting"
      ? t("ordersList.cardLabelPending")
      : activeStatusTab === "cancelled"
        ? t("ordersList.cardLabelCancelled")
        : t("ordersList.cardLabel");
  const selectedCount = selectedCancelledIds.size;
  const showPagination = total > 0 && tableItems.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        // Xatoda va birinchi yuklanishda "Jami 0 ta" YOZILMAYDI — son noma'lum (yuklanishda skelet).
        description={
          isOrdersError && !items.length ? (
            "—"
          ) : isLoading && !data ? (
            <Skeleton width={150} className="my-1" />
          ) : (
            t("ordersList.total", { total: formatNumberLocalized(total, { language }) })
          )
        }
        actions={
          <>
            <Button
              variant="secondary"
              compact
              leftIcon={Download}
              loading={isExporting}
              title={role === "market" ? t("ordersList.exportAllHint") : undefined}
              onClick={() => void handleExportOrders()}
            >
              {t("ordersList.exportExcel")}
            </Button>
            {canCreate ? (
              <Link to="/new-orders/create" className={buttonClasses({ compact: true })}>
                <Plus aria-hidden="true" size={16} strokeWidth={2} />
                {t("ordersList.createOrder")}
              </Link>
            ) : null}
          </>
        }
      />

      <Card
        padding="none"
        aria-label={listLabel}
        footer={
          showPagination ? (
            <Pagination
              page={currentPage}
              pageSize={itemsPerPage}
              total={total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              summary={(range) => t("ordersList.summary", range)}
            />
          ) : undefined
        }
      >
        <Tabs
          items={statusTabs}
          value={activeStatusTab}
          onValueChange={handleStatusTabChange}
          ariaLabel={t("ordersList.tabsLabel")}
          listClassName="px-3"
        />

        {/* Asboblar qatori (qidiruv, sana, «Filtrlar»), panel va chiplar. */}
        <OrderFilters />

        {/* Backend 1000 tadan ortiq mos mijozni kesadi va buni `search_truncated`
            bilan bildiradi — aks holda "bunday buyurtma yo'q" deb o'ylanadi. */}
        {urlSearch && data?.search_truncated ? (
          <div
            role="note"
            className="mx-5 mb-4 flex items-start gap-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning-fg max-md:mx-4"
          >
            <Info aria-hidden="true" size={18} strokeWidth={2} className="mt-px shrink-0" />
            <p className="min-w-0 text-text">
              <span className="font-bold">{t("ordersList.truncatedTitle")}</span> {t("ordersList.truncatedText")}
            </p>
          </div>
        ) : null}

        {/* Tanlov soni ekran o'quvchiga: jonli hudud tanlov paneli paydo bo'lishidan OLDIN DOMda turishi
            kerak — aks holda birinchi tanlov («1 ta buyurtma tanlandi») aytilmaydi. */}
        {canSendCancelledToHq ? (
          <p role="status" className="sr-only">
            {selectedCount > 0 ? t("ordersList.selectedCount", { count: selectedCount }) : ""}
          </p>
        ) : null}

        {canSendCancelledToHq && selectedCount > 0 ? (
          <div
            role="region"
            aria-label={t("ordersList.selectionLabel")}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-action-soft px-5 py-3 max-md:px-4"
          >
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-0.5">
              <span aria-hidden="true" className="text-sm font-semibold text-action-fg">
                {t("ordersList.selectedCount", { count: selectedCount })}
              </span>
              <span className="text-xs text-text-muted">{t("ordersList.selectionHint")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCancelledIds(new Set())}>
                {t("ordersList.clearSelection")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={Send}
                loading={SendToPost.isPending}
                onClick={handleSendCancelledToHq}
              >
                {t("ordersList.sendToHq")}
              </Button>
            </div>
          </div>
        ) : null}

        <OrdersTable
          data={tableItems}
          label={listLabel}
          pinnedOrderId={pinnedOrderId || undefined}
          isError={isOrdersError}
          error={ordersError}
          onRetry={() => void refetchOrders()}
          isLoading={isLoading}
          busy={Boolean(ordersQuery.isPlaceholderData)}
          onRowClick={(order) => navigate(`edit/${order.id}`)}
          canUseOrderActions={canUseOrderActions}
          canSellOrder={canManagerSellOrder}
          onSellOrder={canUseManagerTableActions ? setSellOrder : undefined}
          onCancelOrder={canUseManagerTableActions ? setCancelOrder : undefined}
          onRollbackOrder={canUseManagerTableActions ? setRollbackOrder : undefined}
          isSelectable={canSendCancelledToHq ? isUnsentCancelledOrder : undefined}
          selectedIds={selectedCancelledIds}
          onSelectChange={canSendCancelledToHq ? handleSelectCancelled : undefined}
          onSelectAll={canSendCancelledToHq ? handleSelectAllCancelled : undefined}
          sortConfig={sortConfig}
          onSortChange={handleSortChange}
          onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
          isOrderActionPending={
            SellOrder.isPending ||
            PartlySellOrder.isPending ||
            CancelOrder.isPending ||
            RollbackOrder.isPending
          }
        />
      </Card>

      <SellModal
        order={sellOrder ? selectedActionModalOrder : null}
        open={!!sellOrder}
        onClose={closeSellModal}
        onSell={handleSellOrder}
        onPartlySell={handlePartlySellOrder}
        isLoading={SellOrder.isPending || PartlySellOrder.isPending}
        awaitingApproval={!!sellOrder && approvalOrderId === sellOrder.id}
        variant="manager"
      />
      <CancelModal
        order={cancelOrder ? selectedActionModalOrder : null}
        open={!!cancelOrder}
        onClose={closeCancelModal}
        onCancel={handleCancelOrder}
        isLoading={CancelOrder.isPending}
        awaitingApproval={!!cancelOrder && approvalOrderId === cancelOrder.id}
        variant="manager"
      />
      <RollbackOrderDialog
        order={rollbackOrder}
        variant="manager"
        loading={RollbackOrder.isPending}
        onCancel={() => setRollbackOrder(null)}
        onConfirm={handleRollbackOrder}
      />
    </div>
  );
};

export default memo(Orders);
