import { memo, useState } from "react";
import HeaderName from "../../../../shared/components/headerName";
import { ListOrdered } from "lucide-react";
import Tabs from "./list/tabs";
import OrdersTable from "./list/orderTable";
import { useOrders } from "../../../../entities/orders";

const CourierOrders = () => {
  const [activeTab, setActiveTab] = useState("pending");

  const { getOrderCourier } = useOrders();
  const { data, isLoading } = getOrderCourier();

  // Response: { statusCode, message, data: { data: [...] } }
  const orders = Array.isArray(data?.data?.data) 
    ? data.data.data 
    : Array.isArray(data?.data) 
    ? data.data 
    : [];
    // console.log(orders);
    

  const filteredOrders = orders.filter((order: any) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return order.status === "pending" || order.status === "on the road";
    if (activeTab === "cancelled") return order.status === "cancelled";
    return true;
  });

  console.log(filteredOrders);
  

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
        <Tabs onChange={setActiveTab} defaultTab="pending" />
        <div className="mt-3">
          <OrdersTable orders={orders} loading={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default memo(CourierOrders);