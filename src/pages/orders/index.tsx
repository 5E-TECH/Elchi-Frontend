// dizayn-v2: superadmin-orders-list, superadmin-orders-list-refreshing, superadmin-orders-list-refresh-error, admin-orders-list, registrator-orders-list, market-orders-list, manager-orders-list-all, manager-orders-list-all-refreshing, manager-orders-list-all-refresh-error, manager-orders-list-pending, manager-orders-list-cancelled, superadmin-orders-list-cancelled
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Info, ListX, Plus, Receipt, Repeat, Send } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useOrders } from "../../entities/order/api/orderApi";
import { useOrderStatusCounts } from "../../entities/order/api/orderStatusCounts";
import { useOrders as useOrderActions } from "../../entities/orders";
import {
  pollWhileApprovalPending,
  resolveOrderActionResponse,
} from "../../entities/orders/extraCostApproval";
import type { OrderListItem, OrderListParams } from "../../entities/order/types/order";
import { orderIdFromSearch } from "../../entities/order/model/orderNumber";
import OrderFilters from "./list/OrderFilters";
import CancelStageChips from "./list/CancelStageChips";
import {
  buildOrderListParams,
  isDeliveryType,
  isFulfillmentSource,
  LEGACY_DATE_FROM_KEY,
  LEGACY_DATE_TO_KEY,
  LEGACY_ORDER_STATUS_URL_KEY,
  LEGACY_SEARCH_KEY,
  matchOrderStatusTab,
  normalizeOrderSearch,
  ORDER_FILTER_KEYS,
  ORDER_CANCEL_STAGE_URL_KEY,
  ORDER_LIST_LIMITS,
  ORDER_STATUS_TABS,
  ORDER_STATUS_URL_KEY,
  parseCancelStage,
  parseStatusValues,
  sanitizeDayParam,
  type OrderFilterValues,
  type OrderStatusTabId,
} from "./list/orderFilterModel";
import OrdersTable from "./list/OrdersTable";
import { getOrdersRefetchInterval, ORDERS_REFRESH_INTERVAL_MS, useOrdersRefresh, useOrdersRefreshPaused } from "./list/useOrdersRefresh";
import { OrdersRefreshButton, OrdersRefreshDescription, OrdersRefreshTitleMeta } from "./list/OrdersRefreshMeta";
import { OrdersRefreshAlert } from "./list/OrdersRefreshAlert";
import {
  hasCancelPost,
  isCancelledSentOrder,
  readRollbackEligibility,
  resolveRollbackAvailability,
} from "../../entities/orders/rollbackEligibility";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import type { RootState } from "../../app/config/store";
import { canCreateOrders, canViewCancelReasons, canViewReplacementReturns } from "../../app/lib/access";
import CourierOrders from "./list/courier/index";
import { scrollShellContentToTop, usePagination } from "../../shared/lib/usePagination";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { getUserBranchType } from "../../widgets/Sidebar/model/menuConfig";
import SellModal from "./list/courier/list/SellModal";
import CancelModal from "./list/courier/list/CancelModal";
import RollbackOrderDialog from "./list/courier/list/RollbackOrderDialog";
import { useRollbackOrderFlow } from "./list/courier/list/useRollbackOrderFlow";
import { notifyOrderActionDone, type ActionOrder } from "./list/courier/list/orderActionModel";
import { resetFilters, setFilterValue } from "../../shared/model/filterSlice";
import { clearAllSearch } from "../../shared/model/searchSlice";
import { getOrderItemName } from "../../shared/lib/orderItemName";
import { useOrderQrScanner } from "../../shared/lib/useOrderQrScanner";
import { fetchScanDetail } from "../scan/lib/scanResource";
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import { readQrScopeText } from "../../shared/lib/coverageReasons";
import { orderByRecent, scanNotify, useRecentScans } from "../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../shared/lib/scanner/scanTargets";
import { extractScannerToken } from "../../shared/lib/scanToken";
import {
  findExactScannedRow,
  isScanLookupNotFound,
  scanLookupFailureReason,
  scannedOrderId,
  scannedOrderKeys,
  unwrapScannedOrder,
} from "../../shared/lib/scanner/exactScanMatch";
import { normalizeOrderStatus, ORDER_STATUS_NS, ORDER_STATUS_REGISTRY } from "../../entities/order";
import { useActionDialogError } from "../../entities/orders/actionDialogError";
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
import { isMarketSideRole } from "../../entities/user/lib/role";

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

/**
 * Skan javobidagi buyurtma HQ'ga yuborishda qanday (skan auditi 2026-11-23, #52/#64): `sendable` — ro'yxatning
 * tanlash qoidasi bilan aynan (`isUnsentCancelledOrder`: holat `cancelled`); `sent` — bekorlar pochtasiga solingan /
 * jo'natilgan (`cancelled (sent)`, ro'yxat ko'rinishidagi `transport_status`, `canceled_post_id`); `other` — bekor
 * qilinmagan. Begona filial buyurtmasini backend qidiruvning o'zida rad etadi (403, `readQrScopeText`).
 */
const classifyScannedCancelled = (scanned: Record<string, unknown>): "sendable" | "sent" | "other" => {
  if (isCancelledSentOrder(scanned) || hasCancelPost(scanned)) return "sent";
  return normalizeOrderStatus(scanned.status) === "cancelled" ? "sendable" : "other";
};

/**
 * Sahifada yo'q (skan bilan topilgan) buyurtma joriy filtrlarga mos keladimi. Faqat skan javobida BOR maydonlar
 * tekshiriladi (market, tuman, viloyat, yetkazish turi); javobda yo'q filtr (sana, qidiruv, bosqich, filial, kuryer,
 * manba) — tekshirib bo'lmaydi, to'smaydi. Mos kelmasa — «Filtrga mos emas» (jim tanlanmaydi va «topilmadi» ham emas).
 */
const fitsListFilters = (scanned: Record<string, unknown>, params: OrderListParams) => {
  const district = asRecord(scanned.district);
  const checks: Array<[unknown, unknown]> = [
    [params.market_id, scanned.market_id ?? asRecord(scanned.market).id],
    [params.district_id, scanned.district_id ?? district.id],
    [params.region_id, scanned.region_id ?? asRecord(scanned.region).id ?? district.region_id ?? asRecord(district.region).id],
    [params.where_deliver, scanned.where_deliver],
  ];
  return checks.every(([filter, value]) => {
    const expected = toText(filter);
    const actual = toText(value);
    return !expected || !actual || expected === actual;
  });
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
  // HQ'ga yuborish tanlovi — id bo'yicha, SAHIFAGA BOG'LANMAGAN (skan auditi 2026-11-23, #52/#65): boshqa sahifadagi
  // (skan bilan topilgan) buyurtma ham tanlanadi, sahifa almashsa yoki 60 s yangilanishda ro'yxat sursa ham qoladi.
  const [selectedCancelledIds, setSelectedCancelledIds] = useState<Set<string>>(new Set());
  /** Sahifada yo'q, skan bilan tanlangan buyurtmalar (skan javobidan) — kamera ro'yxati va qayta skan uchun. */
  const [scanPickedRows, setScanPickedRows] = useState<ReadonlyMap<string, OrderListItem>>(new Map());

  const role = useSelector((state: RootState) => state.role.role);
  const currentUser = useSelector((state: RootState) => state.user.user);
  const canCreate = useSelector(canCreateOrders);
  const canSeeCancelReasons = useSelector(canViewCancelReasons);
  // lQjt6sKP: «Almashtirish qaytarmalari» havolasi — superadmin/admin uchun menyuda ham bor, market uchun esa
  // yagona kirish nuqtasi (marketda menyu bandi yo'q).
  const canSeeReplacementReturns = useSelector(canViewReplacementReturns);
  // GykuOz8f: «Qo'shimcha xarajatli buyurtmalar» — market operatorida telefonda «Menyu» yo'q (pastki menyu to'la), shuning
  // uchun sahifaga kirish shu sarlavhadagi havola (boshqa rollarda — yon menyu va «Menyu» varag'ida).
  const canSeeExtraCostsLink = role === "market_operator";
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
  // 6kHnNH9j: «Manba» filtri (`?fulfillment_source=WAREHOUSE|HQ`).
  const urlFulfillmentSource = urlParams[ORDER_FILTER_KEYS.fulfillmentSource] ?? "";
  // Noto'g'ri sana (`?startDay=falonchi`) va bo'sh / «№53» qidiruv API'ga xom ketmaydi (D-08, D-11).
  const urlDateFrom = sanitizeDayParam(urlParams[ORDER_FILTER_KEYS.dateFrom] ?? urlParams[LEGACY_DATE_FROM_KEY]);
  const urlDateTo = sanitizeDayParam(urlParams[ORDER_FILTER_KEYS.dateTo] ?? urlParams[LEGACY_DATE_TO_KEY]);
  const urlSearch = normalizeOrderSearch(urlParams[ORDER_FILTER_KEYS.search] ?? urlParams[LEGACY_SEARCH_KEY]);
  const urlSortBy = urlParams[ORDER_SORT_BY_KEY] ?? "";
  const urlSortDir = urlParams[ORDER_SORT_DIR_KEY] ?? "";
  const sortConfig: DataTableSort | null =
    ORDER_SORT_BY_FIELD[urlSortBy] && (urlSortDir === "asc" || urlSortDir === "desc")
      ? { key: urlSortBy, direction: urlSortDir }
      : null;
  const urlStatuses = useMemo(() => parseStatusValues(urlStatusRaw), [urlStatusRaw]);
  const activeStatusTab = getActiveStatusTab(urlStatuses);
  // BG4: «Bekor qilingan» tabidagi bosqich chipi (`?cancel_stage=hq`); boshqa tabda e'tiborsiz.
  const urlCancelStage = activeStatusTab === "cancelled" ? parseCancelStage(urlParams[ORDER_CANCEL_STAGE_URL_KEY]) : "";

  useEffect(() => {
    if (!urlParams[ORDER_STATUS_URL_KEY] && urlParams[LEGACY_ORDER_STATUS_URL_KEY]) {
      setMultipleParams({
        [ORDER_STATUS_URL_KEY]: urlParams[LEGACY_ORDER_STATUS_URL_KEY],
        [LEGACY_ORDER_STATUS_URL_KEY]: "",
      });
    }
  }, [setMultipleParams, urlParams]);

  useEffect(() => {
    if (!urlParams[ORDER_FILTER_KEYS.search] && urlParams[LEGACY_SEARCH_KEY]) {
      setMultipleParams({
        [ORDER_FILTER_KEYS.search]: urlParams[LEGACY_SEARCH_KEY],
        [LEGACY_SEARCH_KEY]: "",
      });
    }
  }, [setMultipleParams, urlParams]);

  // Holat tabi: holat va 1-sahifa bitta URL yangilanishida (ortiqcha so'rov ketmasin).
  const handleStatusTabChange = useCallback(
    (tabId: string) => {
      const tab = ORDER_STATUS_TABS.find((item) => item.id === tabId);
      if (!tab) return;
      setSelectedCancelledIds((previous) => (previous.size > 0 ? new Set() : previous));
      dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.status, value: [...tab.statuses] }));
      setMultipleParams({
        [ORDER_STATUS_URL_KEY]: tab.statuses.join(","),
        [LEGACY_ORDER_STATUS_URL_KEY]: "",
        [ORDER_CANCEL_STAGE_URL_KEY]: "",
        page: "1",
      });
    },
    [dispatch, setMultipleParams],
  );

  // Bosqich chipi: bosqich va 1-sahifa bitta URL yangilanishida; tanlov (HQ'ga yuborish) tozalanadi.
  const handleCancelStageChange = useCallback(
    (stage: string) => {
      setSelectedCancelledIds(new Set());
      setMultipleParams({ [ORDER_CANCEL_STAGE_URL_KEY]: stage, page: "1" });
    },
    [setMultipleParams],
  );

  const filterValues = useMemo(
    (): OrderFilterValues & { search: string } => ({
      marketId: urlMarketId,
      branchId: urlBranchId,
      regionId: urlRegionId,
      districtId: urlDistrictId,
      courierId: urlCourierId,
      deliveryType: isDeliveryType(urlDeliveryType) ? urlDeliveryType : "",
      fulfillmentSource: isFulfillmentSource(urlFulfillmentSource) ? urlFulfillmentSource : "",
      statuses: urlStatuses,
      cancelStage: urlCancelStage,
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
      urlFulfillmentSource,
      urlStatuses,
      urlCancelStage,
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
    // Sahifa 1 bo'lsa chaqirilmaydi: `setSearchParams` URL o'zgarmasa ham navigatsiya qiladi, butun daraxt ikkinchi
    // marta chiziladi. Tanlangan «Sahifadagi qatorlar soni» saqlanadi (F4RSPBwx: 100 → 10 ga tushib ortiqcha so'rov ketardi).
    if (page !== 1) resetPagination(limit);
  }, [filtersKey, limit, page, resetPagination]);

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

  // Avtomatik yangilanish (OR-1): 60 s va ilovaga qaytganda; oyna yoki kamera ochiq bo'lsa to'xtaydi (tasdiq
  // pollingi — oyna aynan uni kutadi — davom etadi). Kuryer o'z ro'yxatini (`CourierOrders`) o'zi so'raydi.
  // Qaytarish oynasi (BE #738): xato oyna ichida, `Idempotency-Key`, «holat o'zgardi» → qayta o'qib qayta urinish.
  const rollback = useRollbackOrderFlow<OrderListItem>({ mutation: RollbackOrder });
  const refreshPaused = useOrdersRefreshPaused(Boolean(sellOrder || cancelOrder || rollback.order));
  const ordersQuery = useGetOrders(
    apiParams,
    role !== "courier",
    (current) =>
      getOrdersRefetchInterval(
        refreshPaused,
        // So'rovni menejer yozadi: serverdagi kutilayotganlar uchun ham 30 s; boshqa rollar va ochiq oyna — faqat shu
        // qurilma yuborgan so'rov (GykuOz8f).
        pollWhileApprovalPending(current?.data ?? [], { onlyHinted: refreshPaused || role !== "manager" }),
      ),
    { refetchOnWindowFocus: !refreshPaused, silentErrorWhenCached: true },
  );
  const { data, isLoading, isError: isOrdersError, error: ordersError, refetch: refetchOrders } = ordersQuery;

  // GaBIPi3Z: holat tablari sonlari — ro'yxat bilan BIR XIL filtrlar (holatsiz, sahifasiz), bir xil yangilanish
  // (60 s, ilovaga qaytganda, «Yangilash»; oyna ochiq bo'lsa to'xtaydi). Kuryer o'z ro'yxatini va sonlarini
  // (`/orders/courier/orders/counts` — kuryer ro'yxati `total` i bilan teng) `CourierOrders` da o'zi so'raydi.
  const statusCountsParams = useMemo(
    () => buildOrderListParams({ ...filterValues, statuses: [], cancelStage: "" }, role, { page: 0, limit: 0 }),
    [filterValues, role],
  );
  const statusCountsQuery = useOrderStatusCounts(statusCountsParams, {
    enabled: role !== "courier",
    refetchInterval: refreshPaused ? false : ORDERS_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: !refreshPaused,
  });
  const statusCounts = statusCountsQuery.data ?? null;

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
  // rwAy8Qyk: «EL-100081» (ro'yxatdagi raqam) ham — ichki id'ga aylantiriladi (ro'yxatga esa «EL-N» o'zi ketadi).
  const exactSearch = urlSearch.trim();
  const exactOrderId = orderIdFromSearch(exactSearch) ?? (/^\d{1,12}$/.test(exactSearch) ? exactSearch : "");
  const exactOrderQuery = useQuery({
    queryKey: ["orders", "exact-number", exactOrderId],
    queryFn: () =>
      // Yordamchi qidiruv: xatosi yutiladi (`.catch`) — javobsiz bo'lsa global xabar ham yo'q (2026-11-20).
      api
        .get(API_ENDPOINTS.ORDERS.BY_ID(exactOrderId), { silentNetworkError: true })
        .then((res) => {
          const body = res.data as { data?: OrderListItem } | OrderListItem | undefined;
          const order = (body && "data" in body ? body.data : body) as OrderListItem | undefined;
          return order && String(order.id) === exactOrderId ? order : null;
        })
        .catch(() => null),
    enabled: Boolean(exactOrderId) && role !== "courier",
    retry: false,
    staleTime: 30_000,
    // Qadalgan qator ro'yxat bilan birga yangilanadi (OR-1).
    refetchInterval: refreshPaused ? false : ORDERS_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: !refreshPaused,
  });
  const exactOrder = exactOrderQuery.data;
  const pinnedOrderId = exactOrderId && exactOrder && currentPage === 1 ? String(exactOrder.id) : "";
  const tableItems = useMemo<OrderListItem[]>(
    () =>
      pinnedOrderId && exactOrder
        ? [exactOrder, ...items.filter((order) => String(order.id) !== pinnedOrderId)]
        : items,
    [exactOrder, items, pinnedOrderId],
  );
  const refresh = useOrdersRefresh({
    list: ordersQuery,
    extras: [statusCountsQuery, Boolean(exactOrderId) && exactOrderQuery],
  });
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

  // Yangilanishdan keyin tanlov ro'yxatdan chiqib ketgan buyurtmadan tozalanadi, lekin sahifa surilgani uchun emas
  // (#65 — ilgari tanlov har yangilanishda joriy sahifaga qisqarardi: ro'yxat surilib tanlangan buyurtma 2-sahifaga
  // o'tsa, u jim tushib qolardi va «HQ'ga yuborish» uni yubormasdi). Tanlovdan chiqadi: (1) shu sahifada ko'rinib,
  // endi tanlab bo'lmaydigan (masalan boshqa qurilmadan yuborilgan); (2) javob butun tabni qamrasa (bitta sahifa) —
  // unda yo'q tanlov (tabdan chiqqan). Ko'p sahifali tabda boshqa sahifadagi (skan bilan topilgan) tanlov qoladi.
  const wholeCancelledTabShown =
    canSendCancelledToHq && Boolean(data) && !isPlaceholderData && currentPage === 1 && total <= itemsPerPage;
  useEffect(() => {
    if (!canSendCancelledToHq) {
      setSelectedCancelledIds((previous) => previous.size > 0 ? new Set() : previous);
      return;
    }

    const unselectableIds = new Set(
      items.filter((order) => !isUnsentCancelledOrder(order)).map((order) => order.id),
    );
    const inTab = wholeCancelledTabShown
      ? new Set(items.filter(isUnsentCancelledOrder).map((order) => order.id))
      : null;
    setSelectedCancelledIds((previous) => {
      if (previous.size === 0) return previous;
      const next = new Set([...previous].filter((id) => !unselectableIds.has(id) && (!inTab || inTab.has(id))));
      return next.size === previous.size ? previous : next;
    });
  }, [canSendCancelledToHq, items, wholeCancelledTabShown]);

  const canUseOrderActions = useCallback(
    (order: OrderListItem) => canUseManagerTableActions && TABLE_ACTION_STATUSES.has(order.status),
    [canUseManagerTableActions],
  );
  /**
   * «Qaytarish» (BE #738): server maydoni `rollback.allowed` — filial turi, `can_sell_cancel` va holat shartlari
   * e'tiborsiz (server ular bilan birga o'z filiali, pul bosqichi va posilka joyini tekshiradi). Maydon noma'lum
   * (`null` / eski backend) — avvalgi qoida: hududiy menejer, sotilgan yoki bekor, bekor posilka jo'natilmagan.
   */
  const rollbackAvailability = useCallback(
    (order: OrderListItem) =>
      resolveRollbackAvailability(
        order,
        () =>
          canUseManagerTableActions &&
          TABLE_ROLLBACK_STATUSES.has(order.status) &&
          !isCancelledSentOrder(order) &&
          !hasCancelPost(order),
      ),
    [canUseManagerTableActions],
  );
  const canRollbackOrder = useCallback((order: OrderListItem) => rollbackAvailability(order).allowed, [rollbackAvailability]);
  const getRollbackBlockReason = useCallback((order: OrderListItem) => rollbackAvailability(order).reason, [rollbackAvailability]);
  // Amallar ustuni: hududiy menejer (sotish / bekor) — har doim; boshqa menejer (HQ, PICKUP filial) — server biror
  // qatorni qaytarishga ruxsat bergandagina (eski FE bu menejerlarga ustunni umuman chizmasdi).
  const showRollbackActions =
    canUseManagerTableActions ||
    (role === "manager" && tableItems.some((order) => readRollbackEligibility(order)?.allowed === true));
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
      // lQjt6sKP: almashtirish buyurtmasi — sotish oynasida «Eski mahsulotni oldim» tasdig'i.
      replacement_of_order_id: selectedActionOrder.replacement_of_order_id ?? null,
      replacement_state: selectedActionOrder.replacement_state ?? null,
      old_item_collected_at: selectedActionOrder.old_item_collected_at ?? null,
      // GykuOz8f: serverdagi kutilayotgan so'rov (`null` ham) — oynadagi «allaqachon yuborilgan» ogohlantirishi
      // boshqa qurilmada ham ko'rinsin, rad etilgandan keyin esa eski ishora qolib ketmasin.
      ...("pending_extra_cost_approval" in orderFlags
        ? { pending_extra_cost_approval: orderFlags.pending_extra_cost_approval }
        : {}),
      // Hamkor buyurtmasi — xarajat eski (replay) yo'ldan, oynadagi ogohlantirish shunga qarab.
      external_id: selectedActionOrder.external_id ?? null,
      where_deliver: selectedActionOrder.where_deliver,
      market: {
        name: selectedActionOrder.market?.name ?? "—",
        expense_proof_conditions: selectedActionOrder.market?.expense_proof_conditions ?? null,
        extra_cost_requires_approval: selectedActionOrder.market?.extra_cost_requires_approval ?? null,
        extra_cost_enabled: selectedActionOrder.market?.extra_cost_enabled ?? null,
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

  // 2KisY7DL: sotish / qisman sotish / bekor rad etilsa sabab oyna ichida (toast oyna ortida qolardi).
  const { message: sellErrorMessage, show: showSellError, clear: clearSellError } = useActionDialogError(t("orderActionError"));
  const { message: cancelErrorMessage, show: showCancelError, clear: clearCancelError } = useActionDialogError(t("orderActionError"));

  const closeSellModal = useCallback(() => {
    setSellOrder(null);
    setApprovalOrderId(null);
    clearSellError();
  }, [clearSellError]);

  const closeCancelModal = useCallback(() => {
    setCancelOrder(null);
    setApprovalOrderId(null);
    clearCancelError();
  }, [clearCancelError]);

  const handleSellOrder = useCallback(
    (orderId: string, payload: SellOrderPayload) => {
      const order = sellOrder ?? { id: orderId };
      clearSellError();
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
          onError: showSellError,
        },
      );
    },
    [SellOrder, clearSellError, closeSellModal, sellOrder, showSellError, t],
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
      clearSellError();
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
          onError: showSellError,
        },
      );
    },
    [PartlySellOrder, clearSellError, closeSellModal, sellOrder, showSellError],
  );

  const handleCancelOrder = useCallback(
    (
      orderId: string,
      payload: CancelOrderPayload,
    ) => {
      const order = cancelOrder ?? { id: orderId };
      clearCancelError();
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
          onError: showCancelError,
        },
      );
    },
    [CancelOrder, cancelOrder, clearCancelError, closeCancelModal, showCancelError],
  );

  const handleSelectCancelled = useCallback((id: string, checked: boolean) => {
    setSelectedCancelledIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Kamera ro'yxati (Trello v1eLN2tV 2-bosqich): skan tartibi (`order:<id>` / `missing:<kod>`) va ro'yxatda yo'q kodlar.
  const { recent: recentScanKeys, touch: touchRecentScan, clear: clearRecentScans } = useRecentScans();
  const [rejectedScans, setRejectedScans] = useState<{ code: string; reason: string }[]>([]);

  /** Rad etilgan kod — kamera ro'yxatida «<kod> · Rad etildi · <sabab>» (tanlovga kirmaydi). */
  const rejectScannedCode = useCallback((code: string, reason: string, message: string) => {
    if (code) {
      setRejectedScans((previous) => [...previous.filter((item) => item.code !== code), { code, reason }]);
      touchRecentScan(`missing:${code}`);
    }
    void playScanFeedback("missing", message);
  }, [touchRecentScan]);

  /** Holat yorlig'i (`status` nomlar fazosi); noma'lum holat — xom qiymat. */
  const statusLabel = useCallback(
    (raw: unknown) => {
      const status = normalizeOrderStatus(raw);
      return status ? t(ORDER_STATUS_REGISTRY[status].labelKey, { ns: ORDER_STATUS_NS }) : toText(raw) || "—";
    },
    [t],
  );

  /**
   * Tanlab bo'lmaydigan skan — aniq sabab, «Buyurtma topilmadi» emas: allaqachon yuborilgan (`cancelled (sent)`,
   * #64 — qator ro'yxatda ko'rinib turibdi) yoki bekor qilinmagan (holati bilan).
   */
  const rejectUnsendableScan = useCallback(
    (order: Record<string, unknown>, id: string) => {
      if (classifyScannedCancelled(order) === "sent") {
        const description = t("scanAlreadySentDescription", { id });
        scanNotify.warning(t("scanAlreadySentTitle"), { description, duration: 3000 });
        rejectScannedCode(`№${id}`, t("ordersList.cameraReasonSent"), description);
        return;
      }
      const description = t("scanNotCancelledDescription", { id, status: statusLabel(order.status) });
      scanNotify.warning(t("scanNotCancelledTitle"), { description, duration: 3000 });
      rejectScannedCode(`№${id}`, t("ordersList.cameraReasonNotSendable"), description);
    },
    [rejectScannedCode, statusLabel, t],
  );

  /** `picked` — sahifada yo'q, skan javobidan olingan buyurtma (kamera ro'yxati va qayta skan uchun eslab qolinadi). */
  const selectScannedCancelledOrder = useCallback((order: OrderListItem, picked = false) => {
    const name = order.customer?.name ?? `№${order.id}`;
    if (!isUnsentCancelledOrder(order)) {
      rejectUnsendableScan(order as unknown as Record<string, unknown>, String(order.id));
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
    if (picked) setScanPickedRows((previous) => new Map(previous).set(order.id, order));
    touchRecentScan(`order:${order.id}`);
    scanNotify.success(t("scanSelectedTitle"), {
      description: t("ordersList.scanSelected", { name: order.customer?.name ?? "—", id: order.id }),
    });
    void playScanFeedback("success", t("ordersList.cameraSelected", { id: order.id }), undefined, { voice: "selected" });
  }, [rejectUnsendableScan, selectedCancelledIds, t, touchRecentScan]);

  /** Server ham tanimagan kod (404, paket / pochta kodi) — haqiqiy «topilmadi». */
  const rejectUnknownCode = useCallback(
    (code: string) => {
      // Skaner oqimi: xato qisqa turadi (kuryer ro'yxatidagi kelishuv — 3 s), keyingi skanni to'smaydi (G6F68ti6, 16).
      scanNotify.error(t("scanNotFoundTitle"), { description: t("scanUnknownDescription"), duration: 3000 });
      rejectScannedCode(code, t("ordersList.cameraReasonUnknown"), t("scanUnknownDescription"));
    },
    [rejectScannedCode, t],
  );

  /** Bir kod bo'yicha parallel ikki qidiruv ketmasin (USB skaner bir kodni tez qayta yuborsa). */
  const scanLookupsRef = useRef(new Set<string>());

  /**
   * Sahifadagi qatorlarda yo'q kod (skan auditi 2026-11-23). Ro'yxat sahifalangan (sukut 10 ta) — ilgari boshqa
   * sahifadagi haqiqiy bekor «Buyurtma topilmadi — hozirgi ro'yxatda yo'q» bo'lardi (#52), «o'xshash mijoz» bo'yicha
   * esa BOSHQA buyurtma tanlanardi (#54). Endi: server topgan buyurtma (`fetchScanDetail`) → sahifada uning AYNAN
   * o'zi bo'lsa — o'sha qator; aks holda buyurtmaning o'zi tab maqsadiga (jo'natilmagan bekor) va tekshirsa bo'ladigan
   * filtrlarga mos kelsa — tanlanadi (sahifada bo'lmasa ham), mos kelmasa — aniq sabab.
   */
  const handleMissingScannedCancelledOrder = useCallback(async (rawValue: string) => {
    const code = extractScannerToken(rawValue) ?? rawValue.trim();
    const lookupKey = code.toLowerCase();
    if (!lookupKey || scanLookupsRef.current.has(lookupKey)) return;
    scanLookupsRef.current.add(lookupKey);
    try {
      // Yengil javob (`?view=light`, bitta o'qish) va qop zaxirasisiz: bu yerga id, token, holat, market / tuman va
      // ko'rinadigan nomlar yetadi; 404 — bitta so'rovda «topilmadi».
      const detail = await fetchScanDetail(rawValue, { light: true, orderOnly: true });
      const scannedOrder = detail.type === "order" ? unwrapScannedOrder(detail.data) : {};
      const scannedId = scannedOrderId(scannedOrder);
      if (!scannedId) {
        rejectUnknownCode(code);
        return;
      }

      const row = findExactScannedRow(items, scannedOrderKeys(scannedOrder));
      if (row) {
        selectScannedCancelledOrder(row);
        return;
      }

      if (classifyScannedCancelled(scannedOrder) !== "sendable") {
        rejectUnsendableScan(scannedOrder, scannedId);
        return;
      }
      if (!selectedCancelledIds.has(scannedId) && !fitsListFilters(scannedOrder, apiParams)) {
        const description = t("scanFilterMismatchDescription", { id: scannedId });
        scanNotify.warning(t("scanFilterMismatchTitle"), { description, duration: 3000 });
        rejectScannedCode(`№${scannedId}`, t("ordersList.cameraReasonFilter"), description);
        return;
      }
      selectScannedCancelledOrder(
        { ...scannedOrder, id: scannedId, status: "cancelled" } as unknown as OrderListItem,
        true,
      );
    } catch (error) {
      if (isScanLookupNotFound(error)) {
        rejectUnknownCode(code);
        return;
      }
      // Begona QR (#620, anKpzwxk): boshqa filial buyurtmasi — lokal uz/ru/en sabab, «Buyurtma topilmadi» emas.
      const scope = readQrScopeText(t, error);
      if (scope) {
        scanNotify.error(scope.title, { description: scope.description || undefined, duration: 3000 });
        void playScanFeedback("error", scope.line);
        return;
      }
      // Tarmoq, vaqt, 5xx, 429 — «topilmadi» EMAS (#56): qidiruv bajarilmadi, qayta skan odatda o'tadi. Kod rad
      // etilganlar ro'yxatiga tushmaydi.
      const reason = scanLookupFailureReason(t, error, { tooMany: t("scanTooManyRequests") });
      scanNotify.error(t("scanCheckFailedTitle"), { description: reason, duration: 3000 });
      void playScanFeedback("error", t("scanCheckFailedTitle"));
    } finally {
      scanLookupsRef.current.delete(lookupKey);
    }
  }, [
    apiParams,
    items,
    rejectScannedCode,
    rejectUnknownCode,
    rejectUnsendableScan,
    selectScannedCancelledOrder,
    selectedCancelledIds,
    t,
  ]);

  // KAMERA (Trello v1eLN2tV 2-bosqich; maket yo'q — eng yaqini `manager-batches-detail-send-camera`): faqat
  // HYBRID/REGIONAL menejerning «Bekor qilingan» tabida. Sahifada kamera tugmasi yo'q — markaziy «Skaner» /
  // «Skanerlash» shu maqsadni ochadi; kamera skani USB bilan bir yo'l (faqat tanlaydi), yuborish — sahifadagi
  // «HQ'ga yuborish».
  const unsentCancelledCount = useMemo(() => items.filter(isUnsentCancelledOrder).length, [items]);
  /** Tanlangan, lekin shu sahifada yo'q buyurtmalar (boshqa sahifada yoki skan bilan topilgan). */
  const offPageSelectedIds = useMemo(() => {
    const pageIds = new Set(items.map((order) => order.id));
    return [...selectedCancelledIds].filter((id) => !pageIds.has(id));
  }, [items, selectedCancelledIds]);
  /**
   * Skaner indeksi: sahifa qatorlari + sahifada yo'q, skan bilan tanlanganlar — ularning qayta skani so'rovsiz
   * «Allaqachon tanlangan» bo'ladi.
   */
  const cancelledScanIndex = useMemo(() => {
    const picked = offPageSelectedIds
      .map((id) => scanPickedRows.get(id))
      .filter((order): order is OrderListItem => Boolean(order));
    return picked.length > 0 ? [...items, ...picked] : items;
  }, [items, offPageSelectedIds, scanPickedRows]);
  const cancelledCameraList = useMemo<ScanTargetListItem[]>(() => {
    const pageOrders = new Map(items.map((order) => [order.id, order]));
    // Hamma tanlov (sahifadagisi va sahifada yo'q) — boshqa sahifadagi buyurtma ham kamera ro'yxatida ko'rinadi.
    const selectedItems = [...selectedCancelledIds].map<ScanTargetListItem>((id) => {
      const order = pageOrders.get(id) ?? scanPickedRows.get(id);
      return {
        key: `order:${id}`,
        title: [`№${id}`, order?.customer?.name?.trim()].filter(Boolean).join(" · "),
        ...(order
          ? {
              subtitle: [order.district?.name?.trim(), formatMoneyLocalized(Number(order.total_price) || 0, { language })]
                .filter(Boolean)
                .join(" · "),
            }
          : {}),
        tone: "success",
        onUndo: () => handleSelectCancelled(id, false),
      };
    });
    const rejectedItems = rejectedScans.map<ScanTargetListItem>(({ code, reason }) => ({
      key: `missing:${code}`,
      title: code,
      subtitle: t("ordersList.cameraRejected", { reason }),
      tone: "danger",
    }));
    return orderByRecent([...selectedItems, ...rejectedItems], (item) => item.key, recentScanKeys);
  }, [handleSelectCancelled, items, language, recentScanKeys, rejectedScans, scanPickedRows, selectedCancelledIds, t]);

  useOrderQrScanner({
    orders: cancelledScanIndex,
    enabled: canSendCancelledToHq,
    // Sahifa bo'sh bo'lsa ham USB tinglaydi — kod serverdan tekshiriladi (boshqa sahifadagi / yangi bekor).
    keyboardWhenEmpty: true,
    paused: isLoading || SendToPost.isPending,
    onMatch: (order) => selectScannedCancelledOrder(order),
    onMissing: (rawValue) => {
      void handleMissingScannedCancelledOrder(rawValue);
    },
    camera: {
      id: "orders:cancelled-to-hq",
      title: t("ordersList.sendToHq"),
      context: t("ordersList.cameraContext", { value: formatNumberLocalized(unsentCancelledCount, { language }) }),
      note: { title: t("ordersList.cameraNoteTitle"), text: t("ordersList.cameraNoteText") },
      progress: {
        done: selectedCancelledIds.size,
        total: unsentCancelledCount + offPageSelectedIds.length,
        label: t("ordersList.cameraMeter"),
      },
      list: cancelledCameraList,
      listTitle: t("ordersList.cameraListTitle"),
      finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
    },
  });

  // Sarlavha belgisi — faqat SHU sahifadagilar: boshqa sahifadagi (skan bilan) tanlovga tegilmaydi.
  const handleSelectAllCancelled = useCallback((checked: boolean) => {
    const pageIds = items.filter(isUnsentCancelledOrder).map((order) => order.id);
    setSelectedCancelledIds((previous) => {
      const next = new Set(previous);
      pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }, [items]);

  const handleSendCancelledToHq = useCallback(() => {
    if (selectedCancelledIds.size === 0 || SendToPost.isPending) return;

    SendToPost.mutate(Array.from(selectedCancelledIds), {
      onSuccess: () => {
        setSelectedCancelledIds(new Set());
        setScanPickedRows(new Map());
        // Yuborilgandan keyin kamera ro'yxati yangidan (eski «Rad etildi» qatorlari qolmaydi).
        setRejectedScans([]);
        clearRecentScans();
        notify.success(t("sentToHqSuccess"));
      },
      onError: (error: unknown) => {
        const backendMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        notify.error(backendMessage ?? t("sendToHqError"));
      },
    });
  }, [SendToPost, clearRecentScans, selectedCancelledIds, t]);

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
        isFulfillmentSource(urlFulfillmentSource) ||
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
      [ORDER_FILTER_KEYS.fulfillmentSource]: "",
      [ORDER_FILTER_KEYS.dateFrom]: "",
      [ORDER_FILTER_KEYS.dateTo]: "",
      [ORDER_FILTER_KEYS.search]: "",
      [LEGACY_DATE_FROM_KEY]: "",
      [LEGACY_SEARCH_KEY]: "",
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
      ORDER_STATUS_TABS.map((tab) => {
        // Son kelmagan (yuklanmoqda, xato) — tab sonsiz; 0 ham ko'rsatiladi (taxta `tizim-states-navigation`).
        // «Marketga topshirildi» soni eski backendda yo'q (`null`) — faqat o'sha tab sonsiz.
        const count = statusCounts?.[tab.id];
        return {
          value: tab.id,
          label: t(`ordersList.tabs.${tab.id}`),
          title: TAB_HINT_KEYS[tab.id] ? t(TAB_HINT_KEYS[tab.id] as string) : undefined,
          ...(typeof count === "number" ? { count } : {}),
        };
      }),
    [statusCounts, t],
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
        // Matn bloki o'sadi: telefonda «Yangilash» ikonka tugmasi sarlavha qatorining o'ng chetida (maket).
        grow
        meta={<OrdersRefreshTitleMeta refreshing={refresh.refreshing} onRefresh={() => void refresh.refreshAll()} />}
        // Xatoda va birinchi yuklanishda "Jami 0 ta" YOZILMAYDI — son noma'lum (yuklanishda skelet).
        description={
          isOrdersError && !items.length ? (
            "—"
          ) : isLoading && !data ? (
            <Skeleton width={150} className="my-1" />
          ) : (
            <OrdersRefreshDescription
              total={t("ordersList.total", { total: formatNumberLocalized(total, { language }) })}
              lastUpdatedAt={refresh.lastUpdatedAt}
            />
          )
        }
        actions={
          <>
            <OrdersRefreshButton refreshing={refresh.refreshing} onRefresh={() => void refresh.refreshAll()} />
            <Button
              variant="secondary"
              compact
              leftIcon={Download}
              loading={isExporting}
              title={isMarketSideRole(role) ? t("ordersList.exportAllHint") : undefined}
              onClick={() => void handleExportOrders()}
            >
              {t("ordersList.exportExcel")}
            </Button>
            {canSeeCancelReasons ? (
              <Link to="/orders/cancel-reasons" className={buttonClasses({ variant: "secondary", compact: true })}>
                <ListX aria-hidden="true" size={16} strokeWidth={2} />
                {t("cancelReasonStats.title")}
              </Link>
            ) : null}
            {canSeeReplacementReturns ? (
              <Link to="/replacement-returns" className={buttonClasses({ variant: "secondary", compact: true })}>
                <Repeat aria-hidden="true" size={16} strokeWidth={2} />
                {t("ordersList.replacementReturns")}
              </Link>
            ) : null}
            {canSeeExtraCostsLink ? (
              <Link to="/extra-costs" className={buttonClasses({ variant: "secondary", compact: true })}>
                <Receipt aria-hidden="true" size={16} strokeWidth={2} />
                {t("ordersList.extraCosts")}
              </Link>
            ) : null}
            {canCreate ? (
              <Link to="/new-orders/create" className={buttonClasses({ compact: true })}>
                <Plus aria-hidden="true" size={16} strokeWidth={2} />
                {t("ordersList.createOrder")}
              </Link>
            ) : null}
          </>
        }
      />

      {/* Yangilash yiqildi — eski qatorlar qoladi (bo'sh ro'yxatda jadvalning o'z xato holati yetarli). */}
      {refresh.errorVisible && tableItems.length > 0 ? (
        <OrdersRefreshAlert
          retrying={refresh.fetching}
          onRetry={() => void refresh.refreshAll()}
          onDismiss={refresh.dismissError}
        />
      ) : null}

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
          // Fon yangilanishi yoki filtr almashib yangi sonlar kutilmoqda — eski son xira (maket `*-refreshing`).
          countBusy={refresh.refreshing || Boolean(statusCountsQuery.isPlaceholderData && statusCountsQuery.isFetching)}
        />

        {/* Asboblar qatori (qidiruv, sana, «Filtrlar»), panel va chiplar. */}
        <OrderFilters />

        {activeStatusTab === "cancelled" ? (
          <CancelStageChips value={urlCancelStage} onChange={handleCancelStageChange} />
        ) : null}

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
          onRollbackOrder={showRollbackActions ? rollback.open : undefined}
          canRollbackOrder={canRollbackOrder}
          getRollbackBlockReason={getRollbackBlockReason}
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
        error={sellErrorMessage}
        isLoading={SellOrder.isPending || PartlySellOrder.isPending}
        awaitingApproval={!!sellOrder && approvalOrderId === sellOrder.id}
        variant="manager"
      />
      <CancelModal
        order={cancelOrder ? selectedActionModalOrder : null}
        open={!!cancelOrder}
        onClose={closeCancelModal}
        onCancel={handleCancelOrder}
        error={cancelErrorMessage}
        isLoading={CancelOrder.isPending}
        awaitingApproval={!!cancelOrder && approvalOrderId === cancelOrder.id}
        variant="manager"
      />
      <RollbackOrderDialog {...rollback.dialogProps} variant="manager" />
    </div>
  );
};

export default memo(Orders);
