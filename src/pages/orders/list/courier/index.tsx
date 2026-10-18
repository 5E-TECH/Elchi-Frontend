// dizayn-v2: courier-orders-pending, courier-orders-all, courier-orders-cancelled, courier-orders-tab-switcher-open
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Inbox, ScanLine, SearchX, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import Tabs from "./list/tabs";
import SellModal from "./list/SellModal";
import CancelModal from "./list/CancelModal";
import RollbackOrderDialog from "./list/RollbackOrderDialog";
import { notifyOrderActionDone } from "./list/orderActionModel";
import PendingOrdersTable from "./list/ordertable/pendingOrderTable";
import AllOrdersTable from "./list/ordertable/AllOrdersTable";
import CancelledOrdersTable from "./list/ordertable/CancelledOrdersTable";
import {
  isSelectableCancelledOrder,
  isUnsentCancelledOrder,
  normalizeOrderStatus,
  type CourierOrdersTab,
  type Order,
} from "./list/ordertable/courierOrdersModel";
import { useOrders } from "../../../../entities/orders";
import {
  pollWhileApprovalPending,
  resolveOrderActionResponse,
} from "../../../../entities/orders/extraCostApproval";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";
import { scrollShellContentToTop, usePagination } from "../../../../shared/lib/usePagination";
import { useDebounce } from "../../../../shared/lib/useDebounce";
import { useOrderQrScanner } from "../../../../shared/lib/useOrderQrScanner";
import { fetchScanDetail, getBackendErrorMessage } from "../../../scan/lib/scanResource";
import { playScanFeedback } from "../../../scan/lib/scanShared";
import { getActionErrorMessage } from "../../../../shared/lib/actionError";
import { canCourierRestoreCancelledOrder } from "../../../../entities/orders/custody";
import { getRollbackWarning } from "../../../../entities/orders/rollbackResult";
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
  Skeleton,
  SkeletonTable,
  TextInput,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";

/**
 * KURYER «BUYURTMALAR» (`/orders`, rol `courier`) — maketlar `courier-orders-pending` · `-all` ·
 * `-cancelled` · `-tab-switcher-open`; oynalar — `SellModal`, `CancelModal`, `RollbackOrderDialog`.
 *
 *  - ≥ 768: bitta karta — tablar, qidiruv + sana oralig'i (bekor qilinganda — skaner bloki va tanlov
 *    paneli), jadval, sahifalash.
 *  - < 768: tablar va qidiruv karta ustida (butun enda), kartada ro'yxat; bekor qilinganda tanlov —
 *    pastki menyu ustidagi panel («N ta buyurtmani pochtaga yuborish»).
 *
 * Maketdagi «Yetkazish: barchasi» filtri chizilmaydi: kuryer ro'yxati API'si (`GET orders/courier/orders`)
 * yetkazish turi bo'yicha filtrni qabul qilmaydi (faqat `status`, `search`, `startDate`, `endDate`,
 * `page`, `limit`). Tab sonlari ham yo'q — API har holat sonini bermaydi.
 */

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
  const resource = asRecord(nestedData.resource ?? data.resource);
  const payloadData = asRecord(nestedData.payload ?? data.payload);

  return asRecord(
    nestedData.order ??
      data.order ??
      resource.order ??
      payloadData.order ??
      resource ??
      payloadData ??
      nestedData,
  );
};

const addOrderIdentifiers = (target: Set<string>, value: unknown) => {
  const record = asRecord(value);
  const directKeys = [
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
  ];

  directKeys.forEach((key) => {
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
  const sameMarket =
    !a.marketId && !a.marketName
      ? true
      : Boolean(a.marketId && a.marketId === b.marketId) || Boolean(a.marketName && a.marketName === b.marketName);
  const sameDistrict =
    !a.districtId && !a.districtName && !b.districtId && !b.districtName
      ? true
      : Boolean(a.districtId && a.districtId === b.districtId) ||
        Boolean(a.districtName && a.districtName === b.districtName);

  return sameCustomer && sameMarket && sameDistrict;
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
const DATE_FROM_PARAM = "startDay";
const DATE_TO_PARAM = "endDay";
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
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { getParam, setParam, setMultipleParams, removeParam } = useQueryParams();
  const currentUserId = useSelector(
    (state: RootState) => state.user.user?.id ?? state.role.id,
  );
  // fix3b LC-05: bekor qilingan buyurtmani kuryer faqat posilka hali o'zida
  // (holder = shu kuryer) turganda tiklaydi. Filial/HQ qabul qilib bo'lgan
  // bo'lsa backend 400 qaytaradi — tugma ko'rsatilmaydi. Sotilgan qator
  // avvalgidek.
  const canRestoreOrder = useCallback(
    (order: Order) =>
      normalizeOrderStatus(order.status) !== "cancelled" ||
      canCourierRestoreCancelledOrder(order, currentUserId),
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
  const [rollbackOrder, setRollbackOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenSentCancelledOrderIds, setHiddenSentCancelledOrderIds] =
    useState<Set<string>>(getHiddenSentCancelledOrderIds);
  const scanLookupTokensRef = useRef<Set<string>>(new Set());
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "orders",
    defaultLimit: 10,
  });

  useEffect(() => {
    if (!getParam("status")) setParam("status", "waiting");
  }, []);

  // ─── Qidiruv va sana (URL'da; bekor qilingan tabda qo'llanmaydi — u yerda maydonlar yo'q) ─────────
  const urlSearch = getParam(SEARCH_PARAM) ?? "";
  const dateFrom = getParam(DATE_FROM_PARAM) ?? "";
  const dateTo = getParam(DATE_TO_PARAM) ?? "";
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

  const clearFilters = () => {
    setSearchDraft("");
    setMultipleParams({ [SEARCH_PARAM]: "", [DATE_FROM_PARAM]: "", [DATE_TO_PARAM]: "", page: "1" });
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
    ...(withFilters && urlSearch ? { search: urlSearch } : {}),
    ...(withFilters && dateFrom ? { startDate: dateFrom } : {}),
    ...(withFilters && dateTo ? { endDate: dateTo } : {}),
  };

  const ordersQuery = useGetOrderCourier(params, (current) =>
    pollWhileApprovalPending(extractOrderRows(current)),
  );
  const { data, isLoading } = ordersQuery;

  const { mutate: sellMutate, isPending: isSelling } = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;
  const { mutate: rollbackMutate, isPending: isRollbacking } = RollbackOrder;
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
  const selectedSendableCount = selectableOrders.filter((order) => selectedIds.has(order.id)).length;

  const selectScannedOrder = useCallback((order: Order) => {
    if (activeTab === "cancelled" && !isSelectableCancelledOrder(order)) {
      notify.warning(t("scanNotFoundTitle"), { description: t("scanNotFoundDescription"), duration: 2500 });
      void playScanFeedback("missing");
      return;
    }

    if (selectedIds.has(order.id)) {
      notify.warning(t("scanAlreadySelectedTitle"), {
        description: t("scanAlreadySelectedDescription", {
          name: order.customer?.name ?? `#${order.id}`,
        }),
        duration: 2500,
      });
      void playScanFeedback("duplicate");
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(order.id);
      return next;
    });
    notify.success(t("scanSelectedTitle"), {
      description: t("scanSelectedDescription", {
        name: order.customer?.name ?? `#${order.id}`,
      }),
      duration: 2000,
    });
    void playScanFeedback("success");
  }, [activeTab, selectedIds, t]);

  const handleMissingScannedOrder = useCallback(async (rawValue: string) => {
    const tokenKey = rawValue.trim().toLowerCase();
    if (!tokenKey || scanLookupTokensRef.current.has(tokenKey)) return;

    scanLookupTokensRef.current.add(tokenKey);

    try {
      const detail = await fetchScanDetail(rawValue);
      const scannedOrder = detail.type === "order" ? unwrapScannedOrder(detail.data) : {};
      const scannedIdentifiers = getOrderIdentifiers(scannedOrder);
      const matchedByIdentifier = orders.find((order) => {
        const orderIdentifiers = getOrderIdentifiers(order);
        return [...scannedIdentifiers].some((identifier) => orderIdentifiers.has(identifier));
      });
      const comparableMatches = matchedByIdentifier
        ? []
        : orders.filter((order) => isSameCustomerMarketOrder(scannedOrder, order));
      const matchedOrder = matchedByIdentifier ?? (comparableMatches.length === 1 ? comparableMatches[0] : undefined);

      if (matchedOrder) {
        selectScannedOrder(matchedOrder);
        return;
      }

      // Skaner oqimi: xato qisqa turadi (v1 dagidek 3 s) — keyingi skanerlashda ekran to'silib qolmasin.
      notify.error(t("scanNotFoundTitle"), { description: t("scanNotFoundDescription"), duration: 3000 });
      void playScanFeedback("missing");
    } catch (error) {
      notify.error(t("scanNotFoundTitle"), {
        description: getBackendErrorMessage(error) ?? t("scanNotFoundDescription"),
        duration: 3000,
      });
      void playScanFeedback("error");
    } finally {
      scanLookupTokensRef.current.delete(tokenKey);
    }
  }, [orders, selectScannedOrder, t]);

  const scannerEnabled = activeTab === "cancelled" && !isLoading;
  useOrderQrScanner({
    orders,
    enabled: scannerEnabled,
    onMatch: (order) => selectScannedOrder(order),
    onMissing: (rawValue) => {
      void handleMissingScannedOrder(rawValue);
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

  const handleRollbackConfirm = () => {
    if (!rollbackOrder) return;
    const order = rollbackOrder;
    rollbackMutate(order.id, {
      onSuccess: (response) => {
        setRollbackOrder(null);
        // fix3b L1 / CODE-14: rollback bajarildi, lekin bekor qilinganlar
        // pochtasi yaratilmadi — oddiy muvaffaqiyat emas, ogohlantirish.
        const warning = getRollbackWarning(response, t("rollbackCancelPostWarning"));
        if (!warning) {
          notifyOrderActionDone("rollback", order);
          return;
        }
        notify.warning(t("common:warning"), { description: warning, duration: 8000 });
      },
      onError: notifyActionError,
    });
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

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(
      checked
        ? new Set(orders.filter(isSelectableCancelledOrder).map((o) => o.id))
        : new Set(),
    );
  };

  const handleSendToPost = () => {
    const sendableIds = orders
      .filter((order) => selectedIds.has(order.id) && isSelectableCancelledOrder(order))
      .map((order) => order.id);

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
      },
      onError: notifyActionError,
    });
  };

  const handleOpenDetail = (order: Order) => {
    navigate(`edit/${order.id}`);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const regionLabel = t(REGION_LABEL_KEYS[activeTab]);
  const hasFilters = withFilters && Boolean(urlSearch || dateFrom || dateTo);
  const sendLabel = t("sendSelectedToPost", { count: selectedSendableCount });

  // Sarlavha izohi: tabning birinchi yuklanishida skelet chizig'i (maket `courier-orders-tab-switcher-open`),
  // xatoda «—» (son noma'lum — «Jami 0 ta» yozilmaydi).
  const description =
    !shownList && isLoading ? (
      <Skeleton tone="border" width={140} className="my-1.5" />
    ) : !shownList ? (
      "—"
    ) : (
      t("totalOrdersSummary", { count: totalItems })
    );

  const tabs = (
    <Tabs
      activeTab={activeTab}
      onChange={handleTabChange}
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

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={description} />

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
                <DateRange
                  value={{ from: dateFrom, to: dateTo }}
                  onChange={handleDateChange}
                  placeholder={t("courierList.datePlaceholder")}
                  aria-label={t("courierList.dateLabel")}
                  className="min-w-0 max-w-[260px] flex-[1_1_200px]"
                />
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
                    {t("courierList.selectionCount", { selected: selectedSendableCount, total: selectableOrders.length })}
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
                  onRestore={(order) => setRollbackOrder(order)}
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

      <RollbackOrderDialog
        order={rollbackOrder}
        variant="courier"
        loading={isRollbacking}
        onCancel={() => setRollbackOrder(null)}
        onConfirm={handleRollbackConfirm}
      />
    </div>
  );
};

export default memo(CourierOrders);
