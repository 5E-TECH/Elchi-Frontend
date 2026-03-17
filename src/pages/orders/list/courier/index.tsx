import { memo, useState } from "react";
import HeaderName from "../../../../shared/components/headerName";
import { ListOrdered } from "lucide-react";
import Tabs from "./list/tabs";
import OrdersTable from "./list/orderTable";
import SellModal from "./list/SellModal";
import { useOrders } from "../../../../entities/orders";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";

type Order = Parameters<typeof OrdersTable>[0]["orders"][number];

// Tab → backend status mapping
const TAB_STATUS_MAP: Record<string, string | undefined> = {
  pending:   "waiting",
  cancelled: "cancelled",
  all:       undefined,
};

// Backend status → tab mapping (teskari)
const STATUS_TAB_MAP: Record<string, string> = {
  waiting:   "pending",
  cancelled: "cancelled",
};

const CourierOrders = () => {
  const { getParam, setParam, removeParam } = useQueryParams();

  // URL dagi ?status= dan boshlang'ich tabni aniqlaymiz
  const initialStatus = getParam("status");
  const initialTab = initialStatus ? (STATUS_TAB_MAP[initialStatus] ?? "pending") : "pending";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [sellOrder, setSellOrder] = useState<Order | null>(null);

  const { getOrderCourier, SellOrder, PartlySellOrder } = useOrders();

  // Hozirgi tabga mos status — URL dan o'qiymiz (source of truth)
  const statusParam = getParam("status") ?? undefined;
  const params = statusParam ? { status: statusParam } : undefined;

  const { data, isLoading } = getOrderCourier(params);
  const { mutate: sellMutate, isPending: isSelling } = SellOrder;
  const { mutate: partlySellMutate, isPending: isPartlySelling } = PartlySellOrder;

  const orders: Order[] = Array.isArray(data?.data?.data)
    ? data.data.data
    : Array.isArray(data?.data)
    ? data.data
    : [];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const status = TAB_STATUS_MAP[tabId];
    if (status) {
      setParam("status", status);
    } else {
      removeParam("status");
    }
  };

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

  return (
    <div>
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
            showAllActions={activeTab === "all"}
          />
        </div>
      </div>

      <SellModal
        order={sellOrder}
        open={!!sellOrder}
        onClose={() => setSellOrder(null)}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={isSelling || isPartlySelling}
      />
    </div>
  );
};

export default memo(CourierOrders);