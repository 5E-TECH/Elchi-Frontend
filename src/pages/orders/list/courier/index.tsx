import { memo, useState, useEffect } from "react";
import { ListOrdered, Send } from "lucide-react";
import Tabs from "./list/tabs";
import SellModal from "./list/SellModal";
import CancelModal from "./list/CancelModal";
import PopupConfirm from "../../../../shared/components/popupConfirm";
import PendingOrdersTable from "./list/ordertable/pendingOrderTable";
import AllOrdersTable from "./list/ordertable/AllOrdersTable";
import CancelledOrdersTable from "./list/ordertable/CancelledOrdersTable";
import { useOrders } from "../../../../entities/orders";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";
import type { Order } from "./list/ordertable/pendingOrderTable";

const TAB_STATUS_MAP: Record<string, string | undefined> = {
  pending:   "waiting",
  cancelled: "cancelled",
  all:       undefined,
};

const STATUS_TAB_MAP: Record<string, string> = {
  waiting:   "pending",
  cancelled: "cancelled",
};

const CourierOrders = () => {
  const { getParam, setParam, removeParam } = useQueryParams();

  const initialStatus = getParam("status");
  const initialTab = initialStatus
    ? (STATUS_TAB_MAP[initialStatus] ?? "pending")
    : "pending";

  const [activeTab, setActiveTab]           = useState(initialTab);
  const [sellOrder, setSellOrder]           = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder]       = useState<Order | null>(null);
  const [rollbackOrder, setRollbackOrder]   = useState<Order | null>(null);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());

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

  const { mutate: sellMutate,       isPending: isSelling }       = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;
  const { mutate: rollbackMutate,   isPending: isRollbacking }   = RollbackOrder;
  const { mutate: cancelMutate,     isPending: isCancelling }    = CancelOrder;
  const { mutate: sendToPostMutate, isPending: isSendingToPost } = SendToPost;

  const orders: Order[] = Array.isArray(data?.data?.data)
    ? data.data.data
    : Array.isArray(data?.data)
    ? data.data
    : [];

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSell = (
    orderId: string,
    payload: { comment: string; extraCost: number },
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
    },
  ) => {
    partlySellMutate(
      { orderId, data: payload },
      { onSuccess: () => setSellOrder(null) },
    );
  };

  const handleCancel = (
    orderId: string,
    payload: { comment: string; extraCost: number; paidAmount: number },
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
      checked ? next.add(id) : next.delete(id);
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
      <div className="rounded-2xl bg-sidebar p-3 dark:bg-maindark sm:p-4">
        <div className="rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-main/5 px-1 py-1.5 sm:bg-transparent sm:px-0 sm:py-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-main text-primary shadow-lg shadow-main/20 sm:h-13 sm:w-13">
              <ListOrdered size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-bold leading-tight text-main dark:text-primary sm:text-[1.7rem]">
                Buyurtmalar ro'yxati
              </h2>
              <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                Jami {orders.length} ta buyurtma
              </p>
            </div>
          </div>

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
            {selectedIds.size} ta buyurtmani pochtaga yuborish
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
        title="Buyurtmani qaytarish"
        message={
          <>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              #{rollbackOrder?.id}
            </span>{" "}
            buyurtmani kutilayotgan holatga qaytarmoqchimisiz?
          </>
        }
        confirmLabel="Ha, qaytarish"
        cancelLabel="Bekor qilish"
        isLoading={isRollbacking}
        variant="warning"
      />
    </div>
  );
};

export default memo(CourierOrders);
