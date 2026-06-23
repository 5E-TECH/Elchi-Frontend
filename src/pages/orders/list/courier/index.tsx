import { memo, useState, useEffect } from "react";
import { ListOrdered, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
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
    getOrderCourier,
    SellOrder,
    PartlySellOrder,
    RollbackOrder,
    CancelOrder,
    SendToPost,
  } = useOrders();

  const statusParam = getParam("status") ?? undefined;
  const params = statusParam ? { status: statusParam } : undefined;

  const { data, isLoading } = getOrderCourier(params);

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
              onDeliver={(order) => setSellOrder(order)}
              onCancel={(order) => setCancelOrder(order)}
            />
          )}

          {activeTab === "all" && (
            <AllOrdersTable
              orders={orders}
              loading={isLoading}
              onDeliver={(order) => setSellOrder(order)}
              onCancel={(order) => setCancelOrder(order)}
              onRestore={(order) => setRollbackOrder(order)}
            />
          )}

          {activeTab === "cancelled" && (
            <CancelledOrdersTable
              orders={orders}
              loading={isLoading}
              selectedIds={selectedIds}
              onSelectChange={handleSelectChange}
              onSelectAll={handleSelectAll}
            />
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
