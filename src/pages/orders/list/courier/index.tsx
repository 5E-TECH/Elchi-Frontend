import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ListOrdered, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Tabs from "./list/tabs";
import SellModal from "./list/SellModal";
import CancelModal from "./list/CancelModal";
import PopupConfirm from "../../../../shared/components/popupConfirm";
import HeaderName from "../../../../shared/components/headerName";
import PendingOrdersTable from "./list/ordertable/pendingOrderTable";
import AllOrdersTable from "./list/ordertable/AllOrdersTable";
import CancelledOrdersTable from "./list/ordertable/CancelledOrdersTable";
import { useOrders } from "../../../../entities/orders";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";
import { usePagination } from "../../../../shared/lib/usePagination";
import Pagination from "../../../../shared/components/pagination";
import type { Order } from "./list/ordertable/pendingOrderTable";
import { useOrderQrScanner } from "../../../../shared/lib/useOrderQrScanner";
import { fetchScanDetail, getBackendErrorMessage } from "../../../scan/lib/scanResource";
import { playScanFeedback } from "../../../scan/lib/scanShared";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const normalizeMatchText = (value: unknown) => toText(value).toLowerCase();

const formatOrderAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
};

const getOrderPersonName = (order: unknown) => {
  const record = asRecord(order);
  const customer = asRecord(record.customer);
  return toText(
    customer.name ??
      customer.full_name ??
      customer.fullName ??
      record.customer_name ??
      record.customerName ??
      record.name,
  );
};

const getOrderPhone = (order: unknown) => {
  const record = asRecord(order);
  const customer = asRecord(record.customer);
  return toText(
    customer.phone_number ??
      customer.phoneNumber ??
      customer.phone ??
      record.customer_phone ??
      record.customerPhone ??
      record.phone_number ??
      record.phone,
  );
};

const getRollbackOrderSummary = (order: unknown) => {
  const record = asRecord(order);
  const name = getOrderPersonName(order) || (record.id ? `Buyurtma #${record.id}` : "Buyurtma");
  const details = [getOrderPhone(order), formatOrderAmount(record.total_price)]
    .filter(Boolean)
    .join(" • ");

  return { name, details };
};

const normalizeOrderStatus = (value: unknown) =>
  normalizeMatchText(value).replaceAll("_", " ").replace("canceled", "cancelled");

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

const TAB_STATUS_MAP: Record<string, string | undefined> = {
  pending: "waiting",
  cancelled: "cancelled",
  all: undefined,
};

const STATUS_TAB_MAP: Record<string, string> = {
  waiting: "pending",
  pending: "pending",
  canceled: "cancelled",
  cancelled: "cancelled",
};

const isSelectableCancelledOrder = (order: Order) =>
  normalizeOrderStatus(order.status) === "cancelled" &&
  isUnsentCancelledOrder(order);

const isUnsentCancelledOrder = (order: Order) => {
  const record = asRecord(order);
  const transportStatus = normalizeOrderStatus(record.transport_status ?? record.transportStatus);
  const holderType = toText(record.holder_type ?? record.holderType).toUpperCase();
  const parentOrderId = toText(record.parent_order_id ?? record.parentOrderId);
  if (holderType === "BRANCH" || holderType === "HQ") return false;
  return (
    normalizeOrderStatus(order.status) === "cancelled" &&
    transportStatus !== "cancelled (sent)" &&
    !parentOrderId
  );
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

const CourierOrders = () => {
  const { t } = useTranslation("orders");
  const { api: notificationApi } = useAppNotification();
  const navigate = useNavigate();
  const { getParam, setParam, removeParam } = useQueryParams();

  const initialStatus = normalizeOrderStatus(getParam("status"));
  const initialTab = initialStatus
    ? (STATUS_TAB_MAP[initialStatus] ?? "pending")
    : "pending";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [sellOrder, setSellOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
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

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
    resetPagination(limit);
    const status = TAB_STATUS_MAP[tabId];
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

  const statusParam = normalizeCourierStatusParam(getParam("status"));
  const params = {
    ...(statusParam ? { status: statusParam } : {}),
    page,
    limit,
  };

  const { data, isLoading } = useGetOrderCourier(params);

  const { mutate: sellMutate, isPending: isSelling } = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;
  const { mutate: rollbackMutate, isPending: isRollbacking } = RollbackOrder;
  const rollbackSummary = getRollbackOrderSummary(rollbackOrder);
  const { mutate: cancelMutate, isPending: isCancelling } = CancelOrder;
  const { mutate: sendToPostMutate, isPending: isSendingToPost } = SendToPost;

  const rawOrders = extractOrderRows(data);
  const paginationContainer = getPaginationContainer(data);
  const orders = activeTab === "cancelled"
    ? rawOrders.filter((order) => isUnsentCancelledOrder(order) && !hiddenSentCancelledOrderIds.has(order.id))
    : rawOrders;
  const totalItems = toPositiveNumber(paginationContainer.total) ?? orders.length;
  const currentPage = toPositiveNumber(paginationContainer.page) ?? page;
  const itemsPerPage = toPositiveNumber(paginationContainer.limit) ?? limit;
  const selectedSendableCount = orders.filter(
    (order) => selectedIds.has(order.id) && isSelectableCancelledOrder(order),
  ).length;

  const selectScannedOrder = useCallback((order: Order) => {
    if (activeTab === "cancelled" && !isSelectableCancelledOrder(order)) {
      notificationApi.warning({
        message: t("scanNotFoundTitle"),
        description: t("scanNotFoundDescription"),
        placement: "topRight",
        duration: 2.5,
      });
      void playScanFeedback("missing");
      return;
    }

    if (selectedIds.has(order.id)) {
      notificationApi.warning({
        message: t("scanAlreadySelectedTitle"),
        description: t("scanAlreadySelectedDescription", {
          name: order.customer?.name ?? `#${order.id}`,
        }),
        placement: "topRight",
        duration: 2.5,
      });
      void playScanFeedback("duplicate");
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(order.id);
      return next;
    });
    notificationApi.success({
      message: t("scanSelectedTitle"),
      description: t("scanSelectedDescription", {
        name: order.customer?.name ?? `#${order.id}`,
      }),
      placement: "topRight",
      duration: 2,
      });
      void playScanFeedback("success");
  }, [activeTab, notificationApi, selectedIds, t]);

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

      notificationApi.error({
        message: t("scanNotFoundTitle"),
        description: t("scanNotFoundDescription"),
        placement: "topRight",
        duration: 3,
      });
      void playScanFeedback("missing");
    } catch (error) {
      notificationApi.error({
        message: t("scanNotFoundTitle"),
        description: getBackendErrorMessage(error) ?? t("scanNotFoundDescription"),
        placement: "topRight",
        duration: 3,
      });
      void playScanFeedback("error");
    } finally {
      scanLookupTokensRef.current.delete(tokenKey);
    }
  }, [notificationApi, orders, selectScannedOrder, t]);

  useOrderQrScanner({
    orders,
    enabled: activeTab === "cancelled" && !isLoading,
    onMatch: (order) => selectScannedOrder(order),
    onMissing: (rawValue) => {
      void handleMissingScannedOrder(rawValue);
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSell = (
    orderId: string,
    payload: { comment: string; extraCost: number; proof?: File },
  ) => {
    sellMutate(
      { orderId, data: payload },
      { onSuccess: () => setSellOrder(null) },
    );
  };

  const handlePartlySell = (
    orderId: string,
    payload: {
      order_item_info: { product_id: string; quantity: number }[];
      totalPrice: number;
      extraCost: number;
      comment: string;
      proof?: File;
    },
  ) => {
    partlySellMutate(
      { orderId, data: payload },
      { onSuccess: () => setSellOrder(null) },
    );
  };

  const handleCancel = (
    orderId: string,
    payload: { comment: string; extraCost: number; paidAmount: number; proof?: File },
  ) => {
    cancelMutate(
      { orderId, data: payload },
      { onSuccess: () => setCancelOrder(null) },
    );
  };

  const handleRollbackConfirm = () => {
    if (!rollbackOrder) return;
    rollbackMutate(rollbackOrder.id, {
      onSuccess: () => setRollbackOrder(null),
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
    });
  };

  const handleOpenDetail = (order: Order) => {
    navigate(`edit/${order.id}`);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <div>
        <div className="rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-4">
          <HeaderName
            name={t("list")}
            description={t("totalOrdersSummary", { count: orders.length })}
            icon={<ListOrdered />}
          />

          <Tabs onChange={handleTabChange} defaultTab={activeTab} />
        </div>

        <div className="mt-3 sm:mt-4">
          {activeTab === "pending" && (
            <PendingOrdersTable
              orders={orders}
              loading={isLoading}
              onRowClick={handleOpenDetail}
              onDeliver={(order) => setSellOrder(order)}
              onCancel={(order) => setCancelOrder(order)}
            />
          )}

          {activeTab === "all" && (
            <AllOrdersTable
              orders={orders}
              loading={isLoading}
              onRowClick={handleOpenDetail}
              onDeliver={(order) => setSellOrder(order)}
              onCancel={(order) => setCancelOrder(order)}
              onRestore={(order) => setRollbackOrder(order)}
            />
          )}

          {activeTab === "cancelled" && (
            <>
              <div className="mb-3 rounded-2xl border border-main/20 bg-main/10 px-4 py-3 text-sm font-semibold text-maindark dark:border-white/10 dark:bg-white/6 dark:text-white">
                {t("scanSelectHint")}
              </div>
              <CancelledOrdersTable
                orders={orders}
                loading={isLoading}
                onRowClick={handleOpenDetail}
                selectedIds={selectedIds}
                onSelectChange={handleSelectChange}
                onSelectAll={handleSelectAll}
              />
            </>
          )}
        </div>

        {!isLoading && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-primarydark/60 dark:bg-primarydark/60 sm:px-5">
            <Pagination
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setPage}
              onItemsPerPageChange={setLimit}
              className="pt-0"
            />
          </div>
        )}
      </div>

      {/* Floating button */}
      {activeTab === "cancelled" && selectedSendableCount > 0 && (
        <div className="fixed bottom-22 left-3 right-3 z-50 sm:bottom-6 sm:left-auto sm:right-6">
          <button
            onClick={handleSendToPost}
            disabled={isSendingToPost}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition-all hover:bg-red-600 disabled:opacity-60 sm:w-auto"
          >
            {isSendingToPost ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {t("sendSelectedToPost", { count: selectedSendableCount })}
          </button>
        </div>
      )}

      {/* Sell Modal */}
      <SellModal
        order={sellOrder}
        open={!!sellOrder}
        onClose={() => setSellOrder(null)}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={isSelling || isPartlySelling}
      />

      {/* Cancel Modal */}
      <CancelModal
        order={cancelOrder}
        open={!!cancelOrder}
        onClose={() => setCancelOrder(null)}
        onCancel={handleCancel}
        isLoading={isCancelling}
      />

      {/* Rollback Confirm */}
      <PopupConfirm
        isOpen={!!rollbackOrder}
        onClose={() => setRollbackOrder(null)}
        onConfirm={handleRollbackConfirm}
        title={t("rollbackOrder")}
        message={
          <div className="space-y-2 text-center">
            <div className="text-base font-semibold text-gray-800 dark:text-white">
              {rollbackSummary.name}
            </div>
            {rollbackSummary.details && (
              <div className="text-sm font-medium text-gray-500 dark:text-gray-300">
                {rollbackSummary.details}
              </div>
            )}
            <div>{t("rollbackConfirmMessage", { id: rollbackOrder?.id })}</div>
          </div>
        }
        confirmLabel={t("rollbackConfirmLabel")}
        cancelLabel={t("cancelOrderAction")}
        isLoading={isRollbacking}
        variant="warning"
      />
    </div>
  );
};

export default memo(CourierOrders);
