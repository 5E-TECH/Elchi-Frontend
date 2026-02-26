import { memo, useState } from "react";
import { ListOrdered, Plus, ShoppingCart, TrendingUp, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderName from "../../shared/components/headerName";
import Button from "../../shared/components/button";
import { useOrders } from "../../entities/order/api/orderApi";
import type { OrderListItem, OrderListParams } from "../../entities/order/types/order";
import OrderFilters from "./list/OrderFilters";
import OrdersTable from "./list/OrdersTable";
import OrderPagination from "./list/OrderPagination";

const LIMIT = 15;

// ── Stat card ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}
const StatCard = ({ label, value, icon, color }: StatCardProps) => (
  <div className="flex items-center gap-3 bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-5 py-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-xl font-bold text-maindark dark:text-primary leading-tight">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
const Orders = () => {
  const navigate = useNavigate();
  const { getOrders } = useOrders();

  const [params, setParams] = useState<OrderListParams>({
    page: 1,
    limit: LIMIT,
  });

  const { data, isLoading } = getOrders(params);

  const items: OrderListItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT) || 1;

  // Stat hisoblash (client-side, faqat joriy sahifa uchun)
  const newCount = items.filter((o) => o.status === "new").length;
  const onRoadCount = items.filter((o) => o.status === "on the road").length;

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark flex flex-col gap-5 min-h-full">

      {/* ── Header ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-4">
        <div className="flex items-center justify-between">
          <HeaderName
            name="Buyurtmalar ro'yxati"
            description={`Jami ${total} ta buyurtma`}
            icon={<ListOrdered />}
          />
          <Button
            label="Yangi buyurtma"
            icon={<Plus size={16} />}
            onClick={() => navigate("add")}
          />
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Jami buyurtmalar"
          value={total}
          icon={<ShoppingCart size={18} className="text-main" />}
          color="bg-main/10"
        />
        <StatCard
          label="Yangi (joriy sahifa)"
          value={newCount}
          icon={<TrendingUp size={18} className="text-green-500" />}
          color="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard
          label="Yo'lda (joriy sahifa)"
          value={onRoadCount}
          icon={<Clock size={18} className="text-amber-500" />}
          color="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* ── Filters + Table ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm flex flex-col gap-4 p-5">

        {/* Filters */}
        <OrderFilters params={params} onChange={setParams} />

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-primarydark/60" />

        {/* Table */}
        <OrdersTable
          data={items}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {!isLoading && (
          <OrderPagination
            page={params.page ?? 1}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onChange={(p) => setParams((prev) => ({ ...prev, page: p }))}
          />
        )}
      </div>
    </div>
  );
};

export default memo(Orders);
