// dizayn-v2: courier-orders-pending, courier-orders-pending-refreshing, courier-orders-pending-refresh-error, courier-orders-all, courier-orders-cancelled, courier-orders-tab-switcher-open
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, ScanLine, SearchX, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import Tabs from "./list/tabs";
import SellModal from "./list/SellModal";
import CancelModal from "./list/CancelModal";
import RollbackOrderDialog from "./list/RollbackOrderDialog";
import { notifyOrderActionDone, notifyRollbackDone } from "./list/orderActionModel";
import { useRollbackOrderFlow } from "./list/useRollbackOrderFlow";
import PendingOrdersTable from "./list/ordertable/pendingOrderTable";
import AllOrdersTable from "./list/ordertable/AllOrdersTable";
import CancelledOrdersTable from "./list/ordertable/CancelledOrdersTable";
import {
  isRollbackCandidate,
  isSelectableCancelledOrder,
  isUnsentCancelledOrder,
  normalizeOrderStatus,
  type CourierOrdersTab,
  type Order,
} from "./list/ordertable/courierOrdersModel";
import { useOrders } from "../../../../entities/orders";
import { toOrderSearchTerm } from "../../../../entities/order/model/orderNumber";
import {
  pollWhileApprovalPending,
  resolveOrderActionResponse,
} from "../../../../entities/orders/extraCostApproval";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";
import { scrollShellContentToTop, usePagination } from "../../../../shared/lib/usePagination";
import { useDebounce } from "../../../../shared/lib/useDebounce";
import { useOrderQrScanner } from "../../../../shared/lib/useOrderQrScanner";
import { fetchScanDetail } from "../../../scan/lib/scanResource";
import { playScanFeedback } from "../../../../shared/lib/scanner/feedback";
import { readQrScopeText } from "../../../../shared/lib/coverageReasons";
import { orderByRecent, scanNotify, useRecentScans } from "../../../../shared/lib/scanner/scanSession";
import type { ScanTargetListItem } from "../../../../shared/lib/scanner/scanTargets";
import { extractScannerToken } from "../../../../shared/lib/scanToken";
import {
  findExactScannedRow,
  isScanLookupNotFound,
  scanLookupFailureReason,
  scannedOrderId,
  scannedOrderKeys,
  unwrapScannedOrder,
} from "../../../../shared/lib/scanner/exactScanMatch";
import { normalizeOrderStatus as toRegistryStatus, ORDER_STATUS_NS, ORDER_STATUS_REGISTRY } from "../../../../entities/order";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { getActionErrorMessage } from "../../../../shared/lib/actionError";
import { canCourierRestoreCancelledOrder } from "../../../../entities/orders/custody";
import { getRollbackWarning } from "../../../../entities/orders/rollbackResult";
import {
  hasCancelPost,
  isCancelledSentOrder,
  resolveRollbackAvailability,
} from "../../../../entities/orders/rollbackEligibility";
import type { CancelOrderPayload } from "../../../../entities/orders/cancelReason";
import { getSellPaymentStatus, SELL_PAYMENT_NOTICE_KEYS, type SellOrderPayload } from "../../../../entities/orders/sellPayment";
import { notify } from "../../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  DateRange,
  EmptyState,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  Skeleton,
  SkeletonTable,
  TextInput,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import { isDeliveryType, ORDER_FILTER_KEYS } from "../orderFilterModel";
import {
  getOrdersRefetchInterval,
  ORDERS_REFRESH_INTERVAL_MS,
  useOrdersRefresh,
  useOrdersRefreshPaused,
} from "../useOrdersRefresh";
import { OrdersRefreshButton, OrdersRefreshDescription, OrdersRefreshTitleMeta } from "../OrdersRefreshMeta";
import { OrdersRefreshAlert } from "../OrdersRefreshAlert";

/**
 * KURYER «BUYURTMALAR» (`/orders`, rol `courier`) — maketlar `courier-orders-pending` · `-all` ·
 * `-cancelled` · `-tab-switcher-open`; oynalar — `SellModal`, `CancelModal`, `RollbackOrderDialog`.
 *
 *  - ≥ 768: bitta karta — tablar, qidiruv + sana oralig'i + «Yetkazish: barchasi» (bekor qilinganda — skaner
 *    bloki va tanlov paneli), jadval, sahifalash.
 *  - < 768: tablar va qidiruv karta ustida (butun enda), kartada ro'yxat; bekor qilinganda tanlov —
 *    pastki menyu ustidagi panel («N ta buyurtmani pochtaga yuborish»).
 *
 * COURIER-SCAN (ega, 2026-11-17): kuryer skani = qabul — skan bilan olingan buyurtma darhol «Kutilmoqda», alohida
 * «Qabul qilish» tugmasi yo'q. Faol qatorda (yo'ldagi ham) faqat «Sotish» + «Bekor qilish»: yo'ldagini backend
 * sotish/bekordan oldin o'zi qabul qiladi (2026-11-12).
 *
 * Filtrlar URL'da, `GET orders/courier/orders` ga `search`, `startDate`, `endDate`, `where_deliver` bo'lib ketadi.
 * Tab sonlari — `GET orders/courier/orders/counts` (OR-1, 0d11ewk7).
 *
 * Yangilanish (OR-1, `../useOrdersRefresh`): 60 s va ilovaga qaytganda (ro'yxat + tab sonlari), sarlavhada
 * «Oxirgi yangilanish», «Yangilash» (telefonda ikonka tugma); yiqilsa — «Ro'yxat yangilanmadi» (telefonda
 * tablar va qidiruvdan keyin, kartadan oldin).
 */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

/**
 * Skan javobidagi buyurtma pochtaga yuborishda qanday (skan auditi 2026-11-23, #52/#64): `sent` — bekorlar pochtasiga
 * solingan / jo'natilgan; `other` — bekor qilinmagan; `candidate` — bekor, jo'natilmagan (kuryerniki ekanini javob
 * aytmaydi — yengil javobda kuryer yo'q, `fetchCourierCancelledRow` tekshiradi).
 */
const classifyScannedCancelled = (scanned: Record<string, unknown>): "candidate" | "sent" | "other" => {
  if (isCancelledSentOrder(scanned) || hasCancelPost(scanned)) return "sent";
  return normalizeOrderStatus(scanned.status) === "cancelled" ? "candidate" : "other";
};

/** Backend `formatOrderNumber`: «EL-» + (id + 100000) — ro'yxat qidiruvida FAQAT shu id (mijoz qidiruvisiz). */
const exactOrderSearch = (scanned: Record<string, unknown>, id: string) => {
  const orderNumber = toText(scanned.order_number);
  if (/^EL-\d+$/i.test(orderNumber)) return orderNumber;
  const numericId = Number(id);
  return Number.isSafeInteger(numericId) && numericId > 0 ? `EL-${numericId + 100_000}` : id;
};

/**
 * Sahifada yo'q, skan bilan topilgan bekor buyurtma — kuryerning O'Z «Bekor qilingan» ro'yxatidami (#52). Skan javobi
 * buyurtma kimda ekanini aytmaydi (filial doirasi — boshqa kuryerniki ham ochiladi), pochtaga esa backend faqat
 * kuryerning o'zidagini qabul qiladi: ro'yxat so'rovi (`status=cancelled`, «EL-N» — aynan bitta id) javobidagi qator
 * qaytadi, yo'q bo'lsa — `null`.
 */
const fetchCourierCancelledRow = async (scanned: Record<string, unknown>, id: string): Promise<Order | null> => {
  const response = await api.get(API_ENDPOINTS.ORDERS.COURIER_ORDERS, {
    params: { status: "cancelled", search: exactOrderSearch(scanned, id), page: 1, limit: 10 },
    // Skan oqimi: jim qayta urinishsiz (qidiruv kabi) — kuryerning qayta skani qayta urinish.
    failFast: true,
  });
  return extractOrderRows(response.data).find((order) => String(order.id) === id) ?? null;
};

const TAB_STATUS_MAP: Record<CourierOrdersTab, string | undefined> = {
  pending: "waiting",
  cancelled: "cancelled",
  all: undefined,
};

const STATUS_TAB_MAP: Record<string, CourierOrdersTab> = {
  waiting: "pending",
  pending: "pending",
  canceled: "cancelled",
  cancelled: "cancelled",
};

/** URL kalitlari — umumiy buyurtmalar ro'yxati bilan bir xil (`OrderFilters` → `ORDER_FILTER_KEYS`). */
const SEARCH_PARAM = "orderSearch";
/** Telegram botining eski havolalaridagi qidiruv kaliti (`/orders?search=EL-…`, PIJN1lGp gacha) — `orderSearch` ga ko'chadi. */
const LEGACY_SEARCH_PARAM = "search";
const DATE_FROM_PARAM = "startDay";
const DATE_TO_PARAM = "endDay";
const DELIVERY_PARAM = ORDER_FILTER_KEYS.deliveryType;
/** Qidiruv yozilgach so'rov kechikishi (umumiy ro'yxatdagi `FilterSearch` bilan bir xil). */
const SEARCH_DEBOUNCE_MS = 600;

const REGION_LABEL_KEYS: Record<CourierOrdersTab, string> = {
  pending: "courierList.regionPending",
  all: "courierList.regionAll",
  cancelled: "courierList.regionCancelled",
};

const getHiddenSentCancelledOrderIds = () => {
  try {
    const storedValue = window.sessionStorage.getItem("courier_sent_cancelled_order_ids");
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return new Set(Array.isArray(parsedValue) ? parsedValue.map(String) : []);
  } catch {
    return new Set<string>();
  }
};

const saveHiddenSentCancelledOrderIds = (ids: Set<string>) => {
  try {
    window.sessionStorage.setItem("courier_sent_cancelled_order_ids", JSON.stringify([...ids]));
  } catch {
    // Ignore storage errors; the in-memory state still keeps the current view correct.
  }
};

const extractOrderRows = (value: unknown): Order[] => {
  const root = asRecord(value);
  const data = asRecord(root.data);
  const nestedData = asRecord(data.data);
  const candidates = [
    root.data,
    root.orders,
    root.items,
    root.results,
    root.rows,
    data.data,
    data.orders,
    data.items,
    data.results,
    data.rows,
    nestedData.data,
    nestedData.orders,
    nestedData.items,
    nestedData.results,
    nestedData.rows,
  ];

  const rows = candidates.find(Array.isArray);
  return Array.isArray(rows) ? rows as Order[] : [];
};

const getPaginationContainer = (value: unknown) => {
  const root = asRecord(value);
  const data = asRecord(root.data);
  const nestedData = asRecord(data.data);
  return nestedData.data || nestedData.total ? nestedData : data.data || data.total ? data : root;
};

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const normalizeCourierStatusParam = (value: unknown) => {
  const normalizedStatus = normalizeOrderStatus(value);
  if (!normalizedStatus) return undefined;
  const mappedTab = STATUS_TAB_MAP[normalizedStatus];
  return mappedTab ? TAB_STATUS_MAP[mappedTab] : normalizedStatus;
};

/**
 * Telefondagi yuklanish skeleti (maket `courier-orders-tab-switcher-open`): ism + summa, izoh, ikki
 * badge + sana, o'ngda qo'ng'iroq tugmasi; amalli tablarda pastda ikki tugma.
 */
const PHONE_SKELETON_WIDTHS = [
  ["46%", "62%"],
  ["38%", "70%"],
  ["52%", "58%"],
  ["42%", "66%"],
] as const;

const PhoneListSkeleton = ({ withActions }: { withActions: boolean }) => (
  <div className="flex min-w-0 flex-col">
    {PHONE_SKELETON_WIDTHS.map(([title, meta]) => (
      <div key={title} className="relative flex min-w-0 flex-col gap-2.5 border-b border-border px-4 py-3.5 last:border-b-0">
        <div className="flex justify-between gap-4 pr-14">
          <Skeleton tone="border" width={title} height={14} />
          <Skeleton tone="border" width={88} height={14} />
        </div>
        <Skeleton tone="border" width={meta} />
        <div className="flex items-center gap-1.5">
          <Skeleton shape="block" tone="border" width={84} height={24} />
          <Skeleton shape="block" tone="border" width={72} height={24} />
          <Skeleton tone="border" width={72} className="ml-auto" />
        </div>
        {withActions ? (
          <div className="flex gap-2">
            <Skeleton shape="block" tone="border" height={44} className="flex-1" />
            <Skeleton shape="block" tone="border" height={44} className="flex-1" />
          </div>
        ) : null}
        <Skeleton shape="block" tone="border" width={44} height={44} className="absolute right-4 top-3" />
      </div>
    ))}
  </div>
);

const CourierOrders = () => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { getParam, setParam, setMultipleParams, removeParam } = useQueryParams();
  const currentUserId = useSelector(
    (state: RootState) => state.user.user?.id ?? state.role.id,
  );
  // «Qayta tiklash» (BE #738): server maydoni `rollback.allowed` (masalan pul filialga topshirilgan —
  // `COURIER_REMITTED`, tugma yo'q). Maydon noma'lum (`null` / eski backend) — avvalgi qoida: sotilgan yoki bekor,
  // jo'natilmagan; bekor qilingan buyurtma faqat posilka hali shu kuryerda (fix3b LC-05) va bekorlar pochtasida emas.
  const canRestoreOrder = useCallback(
    (order: Order) =>
      resolveRollbackAvailability(
        order,
        () =>
          isRollbackCandidate(order) &&
          (normalizeOrderStatus(order.status) !== "cancelled" ||
            (canCourierRestoreCancelledOrder(order, currentUserId) && !hasCancelPost(order))),
      ).allowed,
    [currentUserId],
  );

  const initialStatus = normalizeOrderStatus(getParam("status"));
  const initialTab: CourierOrdersTab = initialStatus
    ? (STATUS_TAB_MAP[initialStatus] ?? "pending")
    : "pending";

  const [activeTab, setActiveTab] = useState<CourierOrdersTab>(initialTab);
  const [sellOrder, setSellOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  // Market tasdig'iga tushgan amal: modal yopilmaydi, holat ko'rsatiladi.
  const [approvalOrderId, setApprovalOrderId] = useState<string | null>(null);
  // Pochtaga yuborish tanlovi — id bo'yicha, SAHIFAGA BOG'LANMAGAN (skan auditi 2026-11-23, #52/#65): boshqa
  // sahifadagi (skan bilan topilgan) buyurtma ham tanlanadi, sahifa almashsa yoki 60 s yangilanishda ham qoladi.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Sahifada yo'q, skan bilan tanlangan buyurtmalar (ro'yxat so'rovidan) — kamera ro'yxati va qayta skan uchun. */
  const [scanPickedRows, setScanPickedRows] = useState<ReadonlyMap<string, Order>>(new Map());
  const [hiddenSentCancelledOrderIds, setHiddenSentCancelledOrderIds] =
    useState<Set<string>>(getHiddenSentCancelledOrderIds);
  const scanLookupTokensRef = useRef<Set<string>>(new Set());
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "orders",
    defaultLimit: 10,
  });

  useEffect(() => {
    if (!getParam("status")) setParam("status", "waiting");
    const legacySearch = getParam(LEGACY_SEARCH_PARAM);
    if (legacySearch != null) {
      setMultipleParams({ [SEARCH_PARAM]: getParam(SEARCH_PARAM) ?? legacySearch, [LEGACY_SEARCH_PARAM]: "" });
    }
  }, []);

  // ─── Qidiruv, sana va yetkazish (URL'da; bekor qilingan tabda qo'llanmaydi — u yerda maydonlar yo'q) ─────────
  const urlSearch = getParam(SEARCH_PARAM) ?? getParam(LEGACY_SEARCH_PARAM) ?? "";
  const dateFrom = getParam(DATE_FROM_PARAM) ?? "";
  const dateTo = getParam(DATE_TO_PARAM) ?? "";
  const urlDelivery = getParam(DELIVERY_PARAM) ?? "";
  const delivery = isDeliveryType(urlDelivery) ? urlDelivery : "";
  const [searchDraft, setSearchDraft] = useState(urlSearch);
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  // URL tashqaridan o'zgarsa (filtrlarni tozalash, orqaga) — maydon ham yangilanadi. O'zimiz yozgan
  // qiymat (`trim` qilingan) qaytsa maydon tegilmaydi — yozilayotgan oxirgi bo'shliq o'chib ketmasin.
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    if (urlSearch !== searchDraft.trim()) setSearchDraft(urlSearch);
  }

  const applySearch = useCallback(
    (value: string) => {
      const next = value.trim();
      if (next === urlSearch) return;
      setMultipleParams({ [SEARCH_PARAM]: next, page: "1" });
      setSelectedIds(new Set());
    },
    [setMultipleParams, urlSearch],
  );
  const applySearchDebounced = useDebounce(applySearch, SEARCH_DEBOUNCE_MS);

  const handleDateChange = ({ from, to }: { from: string; to: string }) => {
    setMultipleParams({ [DATE_FROM_PARAM]: from, [DATE_TO_PARAM]: to, page: "1" });
  };

  const handleDeliveryChange = (next: string | null) => {
    setMultipleParams({ [DELIVERY_PARAM]: next ?? "", page: "1" });
  };

  const clearFilters = () => {
    setSearchDraft("");
    setMultipleParams({
      [SEARCH_PARAM]: "",
      [DATE_FROM_PARAM]: "",
      [DATE_TO_PARAM]: "",
      [DELIVERY_PARAM]: "",
      page: "1",
    });
  };

  const handleTabChange = (tabId: string) => {
    const nextTab = (STATUS_TAB_MAP[tabId] ?? (tabId === "all" ? "all" : "pending")) as CourierOrdersTab;
    setActiveTab(nextTab);
    setSelectedIds(new Set());
    resetPagination(limit);
    const status = TAB_STATUS_MAP[nextTab];
    if (status) setParam("status", status);
    else removeParam("status");
  };

  const {
    useGetOrderCourier,
    useGetCourierOrderCounts,
    SellOrder,
    PartlySellOrder,
    RollbackOrder,
    CancelOrder,
    SendToPost,
  } = useOrders();

  const withFilters = activeTab !== "cancelled";
  // So'rov holati tabdan (URL bir bosqich kechikib yangilanadi — tab almashganda eski tabning qatorlari
  // yangi tabda ko'rinmasin). URL'da tabga mos kelmaydigan holat bo'lsa (`?status=sold` havolasi) — o'sha.
  const urlStatusParam = normalizeCourierStatusParam(getParam("status"));
  const statusParam =
    activeTab === "pending" && urlStatusParam && !STATUS_TAB_MAP[urlStatusParam]
      ? urlStatusParam
      : TAB_STATUS_MAP[activeTab];
  const params = {
    ...(statusParam ? { status: statusParam } : {}),
    page,
    limit,
    // rwAy8Qyk: ro'yxatdagi raqam («EL-100081») bilan qidirish — backend hozircha faqat ichki id'ni oladi.
    ...(withFilters && urlSearch ? { search: toOrderSearchTerm(urlSearch) } : {}),
    ...(withFilters && dateFrom ? { startDate: dateFrom } : {}),
    ...(withFilters && dateTo ? { endDate: dateTo } : {}),
    ...(withFilters && delivery ? { where_deliver: delivery } : {}),
  };

  // Oyna yoki kamera ochiq — avtomatik yangilanish to'xtaydi (tasdiq pollingi davom etadi).
  // Qaytarish oynasi (BE #738): xato oyna ichida, `Idempotency-Key`, «holat o'zgardi» → qayta o'qib qayta urinish.
  const rollback = useRollbackOrderFlow<Order>({
    mutation: RollbackOrder,
    onSuccess: (response, order, target) => {
      // fix3b L1 / CODE-14: rollback bajarildi, lekin bekor qilinganlar
      // pochtasi yaratilmadi — oddiy muvaffaqiyat emas, ogohlantirish.
      const warning = getRollbackWarning(response, t("rollbackCancelPostWarning"));
      if (!warning) {
        notifyRollbackDone(order, target, response);
        return;
      }
      notify.warning(t("common:warning"), { description: warning, duration: 8000 });
    },
  });
  const refreshPaused = useOrdersRefreshPaused(Boolean(sellOrder || cancelOrder || rollback.order));
  const ordersQuery = useGetOrderCourier(
    params,
    (current) =>
      getOrdersRefetchInterval(
        refreshPaused,
        // Ochiq oyna — faqat shu qurilma yuborgan so'rov natijasi kutiladi (GykuOz8f).
        pollWhileApprovalPending(extractOrderRows(current), { onlyHinted: refreshPaused }),
      ),
    { refetchOnWindowFocus: !refreshPaused, silentErrorWhenCached: true },
  );
  const countsQuery = useGetCourierOrderCounts({
    refetchInterval: refreshPaused ? false : ORDERS_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: !refreshPaused,
  });
  const refresh = useOrdersRefresh({ list: ordersQuery, extras: [countsQuery] });
  const { data, isLoading } = ordersQuery;

  const { mutate: sellMutate, isPending: isSelling } = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;
  const { mutate: cancelMutate, isPending: isCancelling } = CancelOrder;
  const { mutate: sendToPostMutate, isPending: isSendingToPost } = SendToPost;

  // «Bekor qilingan» tabida faqat pochtaga hali yuborilmaganlar (shu sessiyada yuborilganlar ham yashirin).
  const visibleRows = (payload: unknown) => {
    const rows = extractOrderRows(payload);
    return activeTab === "cancelled"
      ? rows.filter((order) => isUnsentCancelledOrder(order) && !hiddenSentCancelledOrderIds.has(order.id))
      : rows;
  };
  const paginationContainer = getPaginationContainer(data);
  const orders = visibleRows(data);
  const isFresh = data !== undefined;

  // Shu tab ichida sahifa/qidiruv/sana almashganda yangi javob kelguncha oxirgi ma'lum jami son turadi
  // (ro'yxatni `QueryBoundary` o'zi saqlaydi): sarlavhadagi «Jami N» skeletga almashmaydi, sahifalash
  // o'chmaydi — bosilgan sahifa tugmasidagi fokus `body` ga tushib qolmaydi. Tab almashsa — eski tab
  // soni ishlatilmaydi (skelet, maket `courier-orders-tab-switcher-open`).
  //
  // «Bekor qilingan» tabida «Jami» (wtmkmJ8h 65c007) — backend `total` i (`courier_cancelled_tab` filtri), qatorlar
  // esa `visibleRows` (`isUnsentCancelledOrder`) dan. Ikki joyda farq qiladi — xatti-harakat ataylab o'zgartirilmagan:
  //  (a) shu sessiyada pochtaga yuborilganlar (`hiddenSentCancelledOrderIds`) qatorlardan darhol yashiriladi, `total`
  //      esa `SendToPost` dan keyingi qayta so'rov kelguncha eski son — vaqtinchalik;
  //  (b) DOIMIY: backend (order-service `courier_cancelled_tab`, origin/main order-service.service.ts ~982-984)
  //      filial/HQ qo'lidagi qisman sotuv bola buyurtmalarini ham sanaydi (`holder_type` BRANCH/HQ,
  //      `parent_order_id` bor, `canceled_post_id` yo'q) — kuryer qo'lidagi bola buyurtmalarni ham filtrlamaydi;
  //      frontend esa ularni yashiradi (`courierOrdersModel.ts` `isUnsentCancelledOrder`: BRANCH/HQ → false,
  //      `parentOrderId` bor → false; `courierOrdersModel.test.ts`). Masalan bitta shunday qator bo'lsa — «Jami 1 ta»
  //      bo'sh ro'yxat ustida. Qaysi tomon to'g'ri — egasi/backend qarori (ochiq savol); bu kesh xatosi emas.
  // Bo'sh ro'yxat (`total` 0) — «Jami 0 ta buyurtma» (fb6aae, `courierOrdersCounts.test.tsx`).
  const freshTotal = isFresh ? (toPositiveNumber(paginationContainer.total) ?? orders.length) : 0;
  const freshHasRows = orders.length > 0;
  const [knownList, setKnownList] = useState<{ tab: CourierOrdersTab; total: number; hasRows: boolean } | null>(null);
  if (
    isFresh &&
    (knownList?.tab !== activeTab || knownList.total !== freshTotal || knownList.hasRows !== freshHasRows)
  ) {
    setKnownList({ tab: activeTab, total: freshTotal, hasRows: freshHasRows });
  }
  const shownList = isFresh
    ? { total: freshTotal, hasRows: freshHasRows }
    : !ordersQuery.isError && knownList?.tab === activeTab
      ? knownList
      : null;
  const totalItems = shownList?.total ?? 0;
  // Oldingi javob ko'rsatilayotganda sahifa va hajm URL'dan (bosilgan sahifa darhol belgilanadi).
  const currentPage = (isFresh ? toPositiveNumber(paginationContainer.page) : undefined) ?? page;
  const itemsPerPage = (isFresh ? toPositiveNumber(paginationContainer.limit) : undefined) ?? limit;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, itemsPerPage)));
  const selectableOrders = orders.filter(isSelectableCancelledOrder);
  const pageOrderIds = new Set(orders.map((order) => order.id));
  /** Tanlangan, lekin shu sahifada yo'q (boshqa sahifada yoki skan bilan topilgan) buyurtmalar. */
  const offPageSelectedIds = [...selectedIds].filter((id) => !pageOrderIds.has(id));
  const selectedSendableCount =
    selectableOrders.filter((order) => selectedIds.has(order.id)).length + offPageSelectedIds.length;
  /** «N / M ta tanlandi» ning M i: sahifadagi yuboriladiganlar + sahifada yo'q tanlanganlar. */
  const selectableTotal = selectableOrders.length + offPageSelectedIds.length;

  // Yangilanishdan keyin tanlov ro'yxatdan chiqib ketgan buyurtmadan tozalanadi (OR-1), lekin sahifa surilgani uchun
  // emas (#65 — ilgari tanlov har yangilanishda joriy sahifaga qisqarardi: yangi bekorlar qo'shilib tanlangan buyurtma
  // 2-sahifaga o'tsa, u jim tushib qolardi va yuborilmasdi). Tanlovdan chiqadi: (1) shu javobda ko'rinib, endi yuborib
  // bo'lmaydigan (jo'natilgan, filialga o'tgan, shu sessiyada yuborilgan); (2) javob butun tabni qamrasa (bitta
  // sahifa) — unda yo'q tanlov (tabdan chiqqan: boshqa qurilmada yuborilgan, qaytarilgan). Ko'p sahifali tabda boshqa
  // sahifadagi tanlov qoladi.
  const unselectableIdsKey = (activeTab === "cancelled" ? extractOrderRows(data) : [])
    .filter((order) => !isSelectableCancelledOrder(order) || hiddenSentCancelledOrderIds.has(order.id))
    .map((order) => String(order.id))
    .join(",");
  const wholeTabShown = activeTab === "cancelled" && isFresh && currentPage === 1 && totalItems <= itemsPerPage;
  const wholeTabSelectableKey = wholeTabShown ? selectableOrders.map((order) => order.id).join(",") : null;
  useEffect(() => {
    if (!unselectableIdsKey && wholeTabSelectableKey === null) return;
    const unselectable = new Set(unselectableIdsKey ? unselectableIdsKey.split(",") : []);
    const inTab = wholeTabSelectableKey === null ? null : new Set(wholeTabSelectableKey ? wholeTabSelectableKey.split(",") : []);
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => !unselectable.has(id) && (!inTab || inTab.has(id))));
      return next.size === previous.size ? previous : next;
    });
  }, [unselectableIdsKey, wholeTabSelectableKey]);

  // Kamera ro'yxati (Trello v1eLN2tV 2-bosqich): skan tartibi (`order:<id>` / `missing:<kod>`) va rad etilgan kodlar.
  const { recent: recentScanKeys, touch: touchRecentScan, clear: clearRecentScans } = useRecentScans();
  const [rejectedScans, setRejectedScans] = useState<{ code: string; reason: string }[]>([]);

  /** Rad etilgan kod — kamera ro'yxatida «<kod> · Rad etildi · <sabab>» (tanlovga kirmaydi). */
  const rejectScannedCode = useCallback((code: string, reason: string, message: string) => {
    if (code) {
      setRejectedScans((prev) => [...prev.filter((item) => item.code !== code), { code, reason }]);
      touchRecentScan(`missing:${code}`);
    }
    void playScanFeedback("missing", message);
  }, [touchRecentScan]);

  /** Holat yorlig'i (`status` nomlar fazosi); noma'lum holat — xom qiymat. */
  const statusLabel = useCallback(
    (raw: unknown) => {
      const status = toRegistryStatus(raw);
      return status ? t(ORDER_STATUS_REGISTRY[status].labelKey, { ns: ORDER_STATUS_NS }) : toText(raw) || "—";
    },
    [t],
  );

  /**
   * Yuborib bo'lmaydigan skan — aniq sabab, «Buyurtma topilmadi» emas: allaqachon yuborilgan (#64), bekor qilinmagan
   * (holati bilan) yoki kuryerning o'zida emas (filialga topshirilgan / boshqa kuryerda).
   */
  const rejectUnsendableScan = useCallback(
    (order: Record<string, unknown>, id: string) => {
      const kind = classifyScannedCancelled(order);
      const [title, description, reason] =
        kind === "sent"
          ? [t("scanAlreadySentTitle"), t("scanAlreadySentDescription", { id }), t("courierList.cameraReasonSent")]
          : kind === "other"
            ? [
                t("scanNotCancelledTitle"),
                t("scanNotCancelledDescription", { id, status: statusLabel(order.status) }),
                t("courierList.cameraReasonNotSendable"),
              ]
            : [t("scanNotYoursTitle"), t("scanNotYoursDescription", { id }), t("courierList.cameraReasonNotYours")];
      scanNotify.warning(title, { description, duration: 3000 });
      rejectScannedCode(`№${id}`, reason, description);
    },
    [rejectScannedCode, statusLabel, t],
  );

  /** `picked` — sahifada yo'q, ro'yxat so'rovidan olingan qator (kamera ro'yxati va qayta skan uchun eslab qolinadi). */
  const selectScannedOrder = useCallback((order: Order, picked = false) => {
    if (activeTab === "cancelled" && !isSelectableCancelledOrder(order)) {
      rejectUnsendableScan(order as unknown as Record<string, unknown>, String(order.id));
      return;
    }

    const name = order.customer?.name ?? `#${order.id}`;
    if (selectedIds.has(order.id)) {
      scanNotify.warning(t("scanAlreadySelectedTitle"), {
        description: t("scanAlreadySelectedDescription", { name }),
        duration: 2500,
      });
      void playScanFeedback("duplicate", t("scanAlreadySelectedDescription", { name }));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(order.id);
      return next;
    });
    if (picked) setScanPickedRows((previous) => new Map(previous).set(order.id, order));
    touchRecentScan(`order:${order.id}`);
    scanNotify.success(t("scanSelectedTitle"), {
      description: t("scanSelectedDescription", { name }),
      duration: 2000,
    });
    void playScanFeedback("success", t("courierList.cameraSelected", { id: order.id }), undefined, { voice: "selected" });
  }, [activeTab, rejectUnsendableScan, selectedIds, t, touchRecentScan]);

  /**
   * Sahifadagi qatorlarda yo'q kod (skan auditi 2026-11-23). Ro'yxat sahifalangan (sukut 10 ta) — ilgari boshqa
   * sahifadagi haqiqiy bekor «Buyurtma topilmadi» bo'lardi (#52), «o'xshash mijoz» bo'yicha esa BOSHQA buyurtma
   * tanlanardi (#54). Endi: server topgan buyurtmaning AYNAN o'zi — sahifada bo'lsa o'sha qator; aks holda bekor va
   * jo'natilmagan bo'lsa kuryerning o'z ro'yxatidan shu id so'raladi va topilsa tanlanadi; bo'lmasa — aniq sabab.
   */
  const handleMissingScannedOrder = useCallback(async (rawValue: string) => {
    const tokenKey = rawValue.trim().toLowerCase();
    if (!tokenKey || scanLookupTokensRef.current.has(tokenKey)) return;

    scanLookupTokensRef.current.add(tokenKey);
    const code = extractScannerToken(rawValue) ?? rawValue.trim();

    try {
      // Yengil javob (`?view=light`, bitta o'qish) va qop zaxirasisiz: bu yerga id, token, holat, market / tuman va
      // ko'rinadigan nomlar yetadi; 404 — bitta so'rovda «topilmadi».
      const detail = await fetchScanDetail(rawValue, { light: true, orderOnly: true });
      const scannedOrder = detail.type === "order" ? unwrapScannedOrder(detail.data) : {};
      const scannedId = scannedOrderId(scannedOrder);
      if (!scannedId) {
        // Skaner oqimi: xato qisqa turadi (v1 dagidek 3 s) — keyingi skanerlashda ekran to'silib qolmasin.
        scanNotify.error(t("scanNotFoundTitle"), { description: t("scanUnknownDescription"), duration: 3000 });
        rejectScannedCode(code, t("courierList.cameraReasonUnknown"), t("scanUnknownDescription"));
        return;
      }

      const row = findExactScannedRow(orders, scannedOrderKeys(scannedOrder));
      if (row) {
        selectScannedOrder(row);
        return;
      }

      if (selectedIds.has(scannedId)) {
        const name = toText(asRecord(scannedOrder.customer).name) || `#${scannedId}`;
        scanNotify.warning(t("scanAlreadySelectedTitle"), {
          description: t("scanAlreadySelectedDescription", { name }),
          duration: 2500,
        });
        void playScanFeedback("duplicate", t("scanAlreadySelectedDescription", { name }));
        return;
      }
      // Shu sessiyada pochtaga yuborilgan (ro'yxatdan yashirilgan) — javob hali eski holatni bersa ham «yuborilgan».
      const scannedState = hiddenSentCancelledOrderIds.has(scannedId)
        ? { ...scannedOrder, transport_status: "cancelled (sent)" }
        : scannedOrder;
      if (classifyScannedCancelled(scannedState) !== "candidate") {
        rejectUnsendableScan(scannedState, scannedId);
        return;
      }
      const member = await fetchCourierCancelledRow(scannedOrder, scannedId);
      if (!member || !isSelectableCancelledOrder(member)) {
        rejectUnsendableScan(member ? (member as unknown as Record<string, unknown>) : scannedOrder, scannedId);
        return;
      }
      selectScannedOrder(member, true);
    } catch (error) {
      if (isScanLookupNotFound(error)) {
        scanNotify.error(t("scanNotFoundTitle"), { description: t("scanUnknownDescription"), duration: 3000 });
        rejectScannedCode(code, t("courierList.cameraReasonUnknown"), t("scanUnknownDescription"));
        return;
      }
      // Begona QR (#620, anKpzwxk): boshqa filial buyurtmasi — lokal uz/ru/en sabab, «Buyurtma topilmadi» emas.
      const scope = readQrScopeText(t, error);
      if (scope) {
        scanNotify.error(scope.title, { description: scope.description || undefined, duration: 3000 });
        void playScanFeedback("error", scope.line);
        return;
      }
      // Tarmoq, vaqt, 5xx, 429 — «topilmadi» EMAS (#56): mobil liniyadagi bitta uzilish ham shu yerga tushadi, qayta
      // skan odatda o'tadi. Kod rad etilganlar ro'yxatiga tushmaydi.
      const reason = scanLookupFailureReason(t, error, { tooMany: t("scanTooManyRequests") });
      scanNotify.error(t("scanCheckFailedTitle"), { description: reason, duration: 3000 });
      void playScanFeedback("error", t("scanCheckFailedTitle"));
    } finally {
      scanLookupTokensRef.current.delete(tokenKey);
    }
  }, [hiddenSentCancelledOrderIds, orders, rejectScannedCode, rejectUnsendableScan, selectScannedOrder, selectedIds, t]);

  // KAMERA (Trello v1eLN2tV 2-bosqich; maket yo'q — `courier-orders-cancelled` dagi «Kamera bilan skanerlash»
  // universal skanerga olib borardi, eng yaqini `courier-mails-detail-receive-camera`): faqat «Bekor qilingan» tabida.
  // Sahifada kamera tugmasi yo'q — markaziy «Skaner» shu maqsadni ochadi; kamera skani USB bilan bir yo'l (faqat
  // tanlaydi), yuborish — sahifadagi «… pochtaga yuborish».
  const cameraList = useMemo<ScanTargetListItem[]>(() => {
    const pageOrders = new Map(orders.map((order) => [order.id, order]));
    // Hamma tanlov (sahifadagisi va sahifada yo'q) — boshqa sahifadagi buyurtma ham kamera ro'yxatida ko'rinadi.
    const selectedItems = [...selectedIds].flatMap<ScanTargetListItem>((id) => {
      const pageOrder = pageOrders.get(id);
      if (pageOrder && !isSelectableCancelledOrder(pageOrder)) return [];
      const order = pageOrder ?? scanPickedRows.get(id);
      return [
        {
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
          onUndo: () =>
            setSelectedIds((prev) => {
              if (!prev.has(id)) return prev;
              const next = new Set(prev);
              next.delete(id);
              return next;
            }),
        },
      ];
    });
    const rejectedItems = rejectedScans.map<ScanTargetListItem>(({ code, reason }) => ({
      key: `missing:${code}`,
      title: code,
      subtitle: t("courierList.cameraRejected", { reason }),
      tone: "danger",
    }));
    return orderByRecent([...selectedItems, ...rejectedItems], (item) => item.key, recentScanKeys);
  }, [language, orders, recentScanKeys, rejectedScans, scanPickedRows, selectedIds, t]);

  /**
   * Skaner indeksi: sahifa qatorlari + sahifada yo'q, skan bilan tanlanganlar — ularning qayta skani so'rovsiz
   * «Allaqachon tanlangan» bo'ladi.
   */
  const scanIndex = useMemo(() => {
    const ids = new Set(orders.map((order) => order.id));
    const picked = [...scanPickedRows.values()].filter((order) => selectedIds.has(order.id) && !ids.has(order.id));
    return picked.length > 0 ? [...orders, ...picked] : orders;
  }, [orders, scanPickedRows, selectedIds]);

  const scannerEnabled = activeTab === "cancelled" && !isLoading;
  useOrderQrScanner({
    orders: scanIndex,
    enabled: activeTab === "cancelled",
    // Sahifa bo'sh bo'lsa ham USB tinglaydi — kod serverdan tekshiriladi (boshqa sahifadagi / yangi bekor).
    keyboardWhenEmpty: true,
    paused: isLoading || isSendingToPost,
    onMatch: (order) => selectScannedOrder(order),
    onMissing: (rawValue) => {
      void handleMissingScannedOrder(rawValue);
    },
    camera: {
      id: "courier-orders:cancelled-to-post",
      title: t("courierList.cameraTitle"),
      context: t("courierList.cameraContext", { value: formatNumberLocalized(selectableOrders.length, { language }) }),
      note: { title: t("courierList.cameraNoteTitle"), text: t("courierList.cameraNoteText") },
      progress: { done: selectedSendableCount, total: selectableTotal, label: t("courierList.cameraMeter") },
      list: cameraList,
      listTitle: t("courierList.cameraListTitle"),
      finish: { label: t("ui:camera.action.finish"), onFinish: () => undefined },
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  // fix3 FE-ORD-02: rad javobining sababi ko'rinadi (avval spinner to'xtab,
  // oyna jimgina ochiq qolardi). Oyna ochiq qoladi — kuryer tuzatib qayta
  // yuboradi. Tarmoq xatosini global bildirishnoma allaqachon ko'rsatgan.
  const notifyActionError = (error: unknown) => {
    const description = getActionErrorMessage(error, t("orderActionError"));
    if (!description) return;
    notify.error(t("common:error"), { description });
  };

  const closeSellModal = () => {
    setSellOrder(null);
    setApprovalOrderId(null);
  };

  const closeCancelModal = () => {
    setCancelOrder(null);
    setApprovalOrderId(null);
  };

  const handleSell = (orderId: string, payload: SellOrderPayload) => {
    const order = sellOrder ?? { id: orderId };
    sellMutate(
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
          if (paymentStatus) {
            notify.success(t(SELL_PAYMENT_NOTICE_KEYS[paymentStatus]));
          }
        },
        onError: notifyActionError,
      },
    );
  };

  const handlePartlySell = (
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
    partlySellMutate(
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
  };

  const handleCancel = (
    orderId: string,
    payload: CancelOrderPayload,
  ) => {
    const order = cancelOrder ?? { id: orderId };
    cancelMutate(
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
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    const order = orders.find((item) => item.id === id);
    if (checked && order && !isSelectableCancelledOrder(order)) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // Sarlavha belgisi — faqat SHU sahifadagilar: boshqa sahifadagi (skan bilan) tanlovga tegilmaydi.
  const handleSelectAll = (checked: boolean) => {
    const pageIds = orders.filter(isSelectableCancelledOrder).map((o) => o.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const handleSendToPost = () => {
    // Sahifadagi yuboriladiganlar + sahifada yo'q tanlov (boshqa sahifada yoki skan bilan topilgan — tanlanganda
    // yuboriladigan edi; o'zgargan bo'lsa backend rad etadi).
    const sendableIds = [
      ...selectableOrders.filter((order) => selectedIds.has(order.id)).map((order) => order.id),
      ...offPageSelectedIds.filter((id) => !hiddenSentCancelledOrderIds.has(id)),
    ];

    if (sendableIds.length === 0) return;
    sendToPostMutate(sendableIds, {
      onSuccess: () => {
        setHiddenSentCancelledOrderIds((prev) => {
          const next = new Set(prev);
          sendableIds.forEach((id) => next.add(id));
          saveHiddenSentCancelledOrderIds(next);
          return next;
        });
        setSelectedIds(new Set());
        setScanPickedRows(new Map());
        // Yuborilgandan keyin kamera ro'yxati yangidan (eski «Rad etildi» qatorlari qolmaydi).
        setRejectedScans([]);
        clearRecentScans();
      },
      onError: notifyActionError,
    });
  };

  const handleOpenDetail = (order: Order) => {
    navigate(`edit/${order.id}`);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const regionLabel = t(REGION_LABEL_KEYS[activeTab]);
  const hasFilters = withFilters && Boolean(urlSearch || dateFrom || dateTo || delivery);
  const sendLabel = t("sendSelectedToPost", { count: selectedSendableCount });

  // Sarlavha izohi: tabning birinchi yuklanishida skelet chizig'i (maket `courier-orders-tab-switcher-open`),
  // xatoda «—» (son noma'lum — «Jami 0 ta» yozilmaydi).
  const description =
    !shownList && isLoading ? (
      <Skeleton tone="border" width={140} className="my-1.5" />
    ) : !shownList ? (
      "—"
    ) : (
      <OrdersRefreshDescription
        total={t("totalOrdersSummary", { count: totalItems })}
        lastUpdatedAt={refresh.lastUpdatedAt}
      />
    );

  const tabs = (
    <Tabs
      activeTab={activeTab}
      onChange={handleTabChange}
      counts={countsQuery.data ?? undefined}
      countBusy={refresh.refreshing}
      fullWidth={isPhone}
      ariaLabel={isPhone ? t("courierList.tabsLabelPhone") : t("courierList.tabsLabel")}
      className={isPhone ? "-mx-4 border-t border-border bg-surface" : undefined}
      listClassName={isPhone ? "px-1" : "px-3"}
    />
  );

  const search = (
    <TextInput
      mode="search"
      value={searchDraft}
      placeholder={t("courierList.searchPlaceholder")}
      aria-label={t("courierList.searchLabel")}
      className={isPhone ? undefined : "min-w-0 flex-[1_1_280px]"}
      onValueChange={(value) => {
        setSearchDraft(value);
        applySearchDebounced(value);
      }}
      onSearch={applySearch}
      onClear={() => applySearch("")}
    />
  );

  const scannerReady = scannerEnabled && selectableOrders.length > 0;

  const tableColumns = [
    t("courierList.colOrder"),
    t("courierList.colCustomer"),
    t("courierList.colArea"),
    t("courierList.colMarket"),
    t("courierList.colStatus"),
    t("courierList.colDelivery"),
    t("courierList.colAmount"),
    ...(withFilters ? [t("courierList.colActions")] : []),
  ];

  const empty = hasFilters ? (
    <EmptyState
      icon={SearchX}
      title={t("courierList.notFound")}
      action={
        <Button variant="secondary" onClick={clearFilters}>
          {t("courierList.clearFilters")}
        </Button>
      }
    />
  ) : (
    <EmptyState icon={Inbox} title={activeTab === "cancelled" ? t("cancelledOrdersEmpty") : t("orderEmpty")} />
  );

  // Telefonda bekor qilinganlar bir sahifaga sig'sa sahifalash yashirin (maket — pastda yuborish paneli).
  const showPagination =
    Boolean(shownList?.hasRows) && !(isPhone && activeTab === "cancelled" && totalPages <= 1);

  const handleRefresh = () => void refresh.refreshAll();
  const refreshAlert = refresh.errorVisible ? (
    <OrdersRefreshAlert
      withCounts
      retrying={refresh.fetching}
      onRetry={handleRefresh}
      onDismiss={refresh.dismissError}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        // Matn bloki o'sadi: telefonda «Yangilash» ikonka tugmasi sarlavha qatorining o'ng chetida (maket).
        grow
        meta={<OrdersRefreshTitleMeta refreshing={refresh.refreshing} onRefresh={handleRefresh} />}
        description={description}
        // Telefonda amallar qatori bo'sh qolmasin — u yerda faqat ikonka tugma.
        actions={isPhone ? undefined : <OrdersRefreshButton refreshing={refresh.refreshing} onRefresh={handleRefresh} />}
      />

      {isPhone ? (
        <>
          {tabs}
          {withFilters ? (
            search
          ) : (
            <div role="note" className="flex items-start gap-2.5 rounded-xl bg-info-soft px-3.5 py-3 text-[13px] text-text">
              <ScanLine aria-hidden="true" size={18} strokeWidth={2} className="mt-px shrink-0 text-info-fg" />
              <p className="m-0 min-w-0">{t("courierList.scanHintPhone")}</p>
            </div>
          )}
        </>
      ) : null}

      {refreshAlert}

      <Card
        padding="none"
        aria-label={regionLabel}
        className="overflow-hidden"
        footer={
          showPagination ? (
            <Pagination
              page={currentPage}
              pageSize={itemsPerPage}
              total={totalItems}
              // Sahifa almashganda ro'yxat boshidan ko'rinsin (D-03 — telefonda pastda qolib ketardi).
              onPageChange={(next) => {
                setPage(next);
                scrollShellContentToTop();
              }}
              onPageSizeChange={(next) => {
                setLimit(next);
                scrollShellContentToTop();
              }}
              summary={(range) => t("paginationSummary", range)}
            />
          ) : undefined
        }
      >
        {isPhone ? null : (
          <>
            {tabs}
            {withFilters ? (
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                {search}
                <div className="flex min-w-0 max-w-[460px] flex-[1_1_400px] gap-3">
                  <div className="min-w-0 flex-1">
                    <DateRange
                      value={{ from: dateFrom, to: dateTo }}
                      onChange={handleDateChange}
                      placeholder={t("courierList.datePlaceholder")}
                      aria-label={t("courierList.dateLabel")}
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Select
                      options={[
                        { value: "", label: t("courierList.deliveryAll") },
                        { value: "address", label: t("deliveryToHome") },
                        { value: "center", label: t("deliveryToCenter") },
                      ]}
                      value={delivery}
                      onChange={handleDeliveryChange}
                      aria-label={t("deliveryType")}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="region"
                aria-label={t("courierList.scanRegion")}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
                >
                  <ScanLine size={20} strokeWidth={2} />
                </span>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="text-sm font-semibold text-text">{t("courierList.scanTitle")}</span>
                    {scannerReady ? (
                      <Badge tone="success" dot role="status">
                        {t("courierList.scanReady")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-[13px] text-text-muted">{t("courierList.scanHint")}</span>
                </div>
              </div>
            )}
            {activeTab === "cancelled" && selectedSendableCount > 0 ? (
              <div
                role="region"
                aria-label={t("courierList.selectionRegion")}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-action-soft px-5 py-3"
              >
                <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                  <span aria-live="polite" className="text-sm font-semibold text-action-fg">
                    {t("courierList.selectionCount", { selected: selectedSendableCount, total: selectableTotal })}
                  </span>
                  <span className="text-xs text-text-muted">{t("courierList.selectionHint")}</span>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    {t("courierList.clearSelection")}
                  </Button>
                  <Button leftIcon={Send} loading={isSendingToPost} onClick={handleSendToPost}>
                    {sendLabel}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        <QueryBoundary
          // Tab almashsa — oldingi tab qatorlari ko'rsatilmaydi, skelet chiqadi (`courier-orders-tab-switcher-open`).
          key={activeTab}
          query={ordersQuery}
          isEmpty={(payload) => visibleRows(payload).length === 0}
          loading={
            isPhone ? (
              <PhoneListSkeleton withActions={withFilters} />
            ) : (
              <SkeletonTable framed={false} columns={tableColumns} rows={Math.min(itemsPerPage, 8)} />
            )
          }
          loadingLabel={t("courierList.loading", { list: regionLabel })}
          empty={empty}
          className={isPhone ? undefined : "border-t border-border"}
        >
          {(payload, { isRefetching }) => (
            <>
              {activeTab === "pending" && (
                <PendingOrdersTable
                  orders={visibleRows(payload)}
                  label={regionLabel}
                  busy={isRefetching}
                  onRowClick={handleOpenDetail}
                  onDeliver={(order) => setSellOrder(order)}
                  onCancel={(order) => setCancelOrder(order)}
                />
              )}

              {activeTab === "all" && (
                <AllOrdersTable
                  orders={visibleRows(payload)}
                  label={regionLabel}
                  busy={isRefetching}
                  onRowClick={handleOpenDetail}
                  onDeliver={(order) => setSellOrder(order)}
                  onCancel={(order) => setCancelOrder(order)}
                  onRestore={rollback.open}
                  canRestore={canRestoreOrder}
                />
              )}

              {activeTab === "cancelled" && (
                <CancelledOrdersTable
                  orders={visibleRows(payload)}
                  label={regionLabel}
                  busy={isRefetching}
                  onRowClick={handleOpenDetail}
                  selectedIds={selectedIds}
                  onSelectChange={handleSelectChange}
                  onSelectAll={handleSelectAll}
                />
              )}
            </>
          )}
        </QueryBoundary>
      </Card>

      {/* Telefon: tanlanganlarni yuborish — pastki menyu ustidagi panel (maket `courier-orders-cancelled`). */}
      {isPhone && activeTab === "cancelled" && selectedSendableCount > 0 ? (
        <>
          <div aria-hidden="true" className="h-[72px] shrink-0" />
          <div className="fixed inset-x-0 bottom-[var(--shell-bottomnav-h)] z-30 border-t border-border bg-surface px-4 py-3">
            <Button size="lg" fullWidth leftIcon={Send} loading={isSendingToPost} onClick={handleSendToPost}>
              {sendLabel}
            </Button>
          </div>
        </>
      ) : null}

      <SellModal
        order={sellOrder}
        open={!!sellOrder}
        onClose={closeSellModal}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={isSelling || isPartlySelling}
        awaitingApproval={!!sellOrder && approvalOrderId === sellOrder.id}
        restrictExtraCostToCenter
      />

      <CancelModal
        order={cancelOrder}
        open={!!cancelOrder}
        onClose={closeCancelModal}
        onCancel={handleCancel}
        isLoading={isCancelling}
        awaitingApproval={!!cancelOrder && approvalOrderId === cancelOrder.id}
      />

      <RollbackOrderDialog {...rollback.dialogProps} variant="courier" />
    </div>
  );
};

export default memo(CourierOrders);
