import { Package, ShoppingCart, Store } from "lucide-react";
import { memo } from "react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useOrders } from "../../../entities/orders";

interface MarketOrder {
  id: number;
  market: string;
  phone: string;
  total_price: number;
  orders: number;
}

const columns: ColumnConfig<MarketOrder>[] = [
  {
    key: "id",
    label: "#",
    width: "5%",
  },
  {
    key: "market",
    label: "Market",
    width: "30%",
    sortable: true,
  },
  {
    key: "phone",
    label: "Phone",
    width: "25%",
  },
  {
    key: "total_price",
    label: "Total Price",
    width: "20%",
    sortable: true,
  },
  {
    key: "orders",
    label: "Buyurtmalar",
    width: "20%",
    sortable: true,
  },
];

const Markets = () => {

  const { getTodayOrders } = useOrders();
  const { data: todayOrders } = getTodayOrders();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 p-4 rounded-2xl w-full bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10">
          <div className="p-2.5 rounded-xl bg-main/10 dark:bg-main/20 text-main">
            <Store size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 dark:text-gray-400 font-medium">
              Markets
            </span>
            <strong className="text-lg text-gray-800 dark:text-white leading-tight">
              2 ta
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl w-full bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500">
            <ShoppingCart size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 dark:text-gray-400 font-medium">
              Jami buyurtmalar
            </span>
            <strong className="text-lg text-gray-800 dark:text-white leading-tight">
              2 ta
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl w-full bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10">
          <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 dark:text-gray-400 font-medium">
              Umumiy buyurtmalar
            </span>
            <strong className="text-lg text-gray-800 dark:text-white leading-tight">
              2 ta
            </strong>
          </div>
        </div>
      </div>

      <Table<MarketOrder>
        data={todayOrders || []}
        columns={columns}
        keyExtractor={(item) => item.id}
        hoverable
        emptyMessage="Buyurtmalar topilmadi"
      />
    </div>
  );
};

export default memo(Markets);