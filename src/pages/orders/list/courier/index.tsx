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

const unwrapScannedOrder = (payload: unknown) => {
  const source = asRecord(payload);
  const data = asRecord(source.data ?? source);
  const nestedData = asRecord(data.data ?? data);
  return asRecord(nestedData.order ?? data.order ?? nestedData);
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
    phone: normalizeMatchText(customer.phone_number ?? customer.phone ?? order.phone_number ?? order.phone),
    marketId: normalizeMatchText(order.market_id ?? order.marketId ?? market.id),
    marketName: normalizeMatchText(market.name),
    districtId: normalizeMatchText(order.district_id ?? order.districtId ?? district.id),
    districtName: normalizeMatchText(district.name),
  };
};

const isSameCustomerMarketOrder = (left: unknown, right: unknown) => {
  const a = getComparableOrderInfo(left);
  const b = getComparableOrderInfo(right);
  const sameCustomer = Boolean(a.customerId && a.customerId === b.customerId) || Boolean(a.phone && a.phone === b.phone);
  const sameMarket = Boolean(a.marketId && a.marketId === b.marketId) || Boolean(a.marketName && a.marketName === b.marketName);
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
  cancelled: "cancelled",
};

const CourierOrders = () => {
  const { t } = useTranslation("orders");
  const { api: notificationApi } = useAppNotification();
  const navigate = useNavigate();
  const { getParam, setParam, removeParam } = useQueryParams();

  const initialStatus = getParam("status");
  const initialTab = initialStatus
    ? (STATUS_TAB_MAP[initialStatus] ?? "pending")
    : "pending";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [sellOrder, setSellOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [rollbackOrder, setRollbackOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scanLookupTokensRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!getParam("status")) setParam("status", "waiting");
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
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

  const statusParam = getParam("status") ?? undefined;
  const params = statusParam ? { status: statusParam } : undefined;

  const { data, isLoading } = useGetOrderCourier(params);

  const { mutate: sellMutate, isPending: isSelling } = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;
  const { mutate: rollbackMutate, isPending: isRollbacking } = RollbackOrder;
  const { mutate: cancelMutate, isPending: isCancelling } = CancelOrder;
  const { mutate: sendToPostMutate, isPending: isSendingToPost } = SendToPost;

  const orders: Order[] = Array.isArray(data?.data?.data)
    ? data.data.data
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const selectScannedOrder = useCallback((order: Order) => {
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
  }, [notificationApi, selectedIds, t]);

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
    setSelectedIds(checked ? new Set(orders.map((o) => o.id)) : new Set());
  };

  const handleSendToPost = () => {
    if (selectedIds.size === 0) return;
    sendToPostMutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
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
      </div>

      {/* Floating button */}
      {activeTab === "cancelled" && selectedIds.size > 0 && (
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
            {t("sendSelectedToPost", { count: selectedIds.size })}
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
          <>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              #{rollbackOrder?.id}
            </span>{" "}
            {t("rollbackConfirmMessage", { id: rollbackOrder?.id })}
          </>
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
