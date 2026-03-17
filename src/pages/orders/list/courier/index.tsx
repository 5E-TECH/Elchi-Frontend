import { memo, useState, useEffect } from "react";
import HeaderName from "../../../../shared/components/headerName";
import { ListOrdered, Send } from "lucide-react";
import Tabs from "./list/tabs";
import OrdersTable from "./list/orderTable";
import SellModal from "./list/SellModal";
import PopupConfirm from "../../../../shared/components/popupConfirm";
import { useOrders } from "../../../../entities/orders";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";

type Order = Parameters<typeof OrdersTable>[0]["orders"][number];

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
  const initialTab = initialStatus ? (STATUS_TAB_MAP[initialStatus] ?? "pending") : "pending";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [sellOrder, setSellOrder] = useState<Order | null>(null);
  const [rollbackOrder, setRollbackOrder] = useState<Order | null>(null);

  // ✅ Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!getParam("status")) {
      setParam("status", "waiting");
    }
  }, []);

  // Tab o'zgarganda selectionni tozalaymiz
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
    const status = TAB_STATUS_MAP[tabId];
    if (status) {
      setParam("status", status);
    } else {
      removeParam("status");
    }
  };

  const { getOrderCourier, SellOrder, PartlySellOrder, RollbackOrder, SendToPost } = useOrders();

  const statusParam = getParam("status") ?? undefined;
  const params = statusParam ? { status: statusParam } : undefined;

  const { data, isLoading } = getOrderCourier(params);
  const { mutate: sellMutate, isPending: isSelling } = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;
  const { mutate: rollbackMutate, isPending: isRollbacking } = RollbackOrder;
  const { mutate: sendToPostMutate, isPending: isSendingToPost } = SendToPost; // ✅

  const orders: Order[] = Array.isArray(data?.data?.data)
    ? data.data.data
    : Array.isArray(data?.data)
    ? data.data
    : [];

  const handleSell = (
    orderId: string,
    payload: { comment: string; extraCost: number }
  ) => {
    sellMutate(
      { orderId, data: payload },
      { onSuccess: () => setSellOrder(null) }
    );
  };

  const handlePartlySell = (
    orderId: string,
    payload: {
      order_item_info: { product_id: string; quantity: number }[];
      totalPrice: number;
      extraCost: number;
      comment: string;
    }
  ) => {
    partlySellMutate(
      { orderId, data: payload },
      { onSuccess: () => setSellOrder(null) }
    );
  };

  const handleRollbackConfirm = () => {
    if (!rollbackOrder) return;
    rollbackMutate(rollbackOrder.id, {
      onSuccess: () => setRollbackOrder(null),
    });
  };

  // ✅ Checkbox handlers
  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // ✅ Pochtaga yuborish
  const handleSendToPost = () => {
    if (selectedIds.size === 0) return;
    sendToPostMutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  // Faqat cancelled tabda checkbox ko'rinadi
  const isCancelledTab = activeTab === "cancelled";

  return (
    <div className="relative">
      <div className="bg-sidebar dark:bg-maindark p-3 rounded-2xl">
        <div className="flex items-center justify-between">
          <HeaderName
            name="Buyurtmalar ro'yxati"
            description={`Jami ${orders.length} ta buyurtma`}
            icon={<ListOrdered />}
          />
        </div>
        <Tabs onChange={handleTabChange} defaultTab={activeTab} />
        <div className="mt-3">
          <OrdersTable
            orders={orders}
            loading={isLoading}
            onDeliver={(order) => setSellOrder(order)}
            onRestore={(order) => setRollbackOrder(order)}
            showAllActions={activeTab === "all"}
            // ✅ faqat cancelled tabda checkbox
            selectedIds={isCancelledTab ? selectedIds : undefined}
            onSelectChange={isCancelledTab ? handleSelectChange : undefined}
            onSelectAll={isCancelledTab ? handleSelectAll : undefined}
          />
        </div>
      </div>

      {/* ✅ Floating button — faqat cancelled tabda va kamida 1 ta tanlanganda */}
      {isCancelledTab && selectedIds.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleSendToPost}
            disabled={isSendingToPost}
            className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-semibold text-sm rounded-2xl shadow-2xl transition-all"
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

      <SellModal
        order={sellOrder}
        open={!!sellOrder}
        onClose={() => setSellOrder(null)}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={isSelling || isPartlySelling}
      />

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