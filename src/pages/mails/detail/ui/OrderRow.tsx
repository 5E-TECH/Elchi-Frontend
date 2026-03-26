import { memo } from "react";
import {
  Phone,
  Store,
  User,
  MapPin,
  Building2,
  Calendar,
  Package2,
  House,
} from "lucide-react";
import type { PostOrder, OrderStatus } from "../../../../entities/mails";
import { formatDate, formatPrice, getStatusLabel, getStatusStyle } from "../lib/helpers";
import { printOrders } from "../lib/printMode";
import Checkbox from "./Checkbox";
import { TABLE_COLS } from "./OrdersTable";
import PrintModeSelect from "./PrintModeSelect";

interface OrderRowProps {
  order: PostOrder;
  checked: boolean;
  onToggle: (id: string) => void;
}

const OrderRow = memo(({ order, checked, onToggle }: OrderRowProps) => {
  const customerName = order.customer?.name ?? `Mijoz #${order.customer_id}`;
  const customerPhone = order.customer?.phone_number ?? "Telefon yo'q";
  const districtName = order.district?.name ?? `Tuman #${order.district_id}`;
  const marketName = order.market?.name ?? `Market #${order.market_id}`;
  const isAddressDelivery = order.where_deliver === "address";

  return (
    <div
      className={`group grid ${TABLE_COLS} items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
        checked
          ? "bg-main/10 border-main/40 shadow-sm"
          : "bg-white dark:bg-white/4 border-gray-100 dark:border-white/8 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-white/6"
      }`}
      onClick={() => onToggle(order.id)}
    >
      <Checkbox checked={checked} onChange={() => onToggle(order.id)} />

      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 shrink-0">
          <User size={13} className="text-slate-500 dark:text-white/70" />
        </div>
        <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
          {customerName}
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <Phone size={12} className="text-black dark:text-white/50 shrink-0" />
        <span className="text-xs text-gray-500 dark:text-white font-medium truncate">
          {customerPhone}
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <MapPin size={12} className="text-black dark:text-white/50 shrink-0" />
        <span className="text-xs text-gray-500 dark:text-white font-medium truncate">
          {districtName}
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <Store size={12} className="text-black dark:text-white/50 shrink-0" />
        <span className="text-xs text-gray-600 dark:text-white font-semibold truncate">
          {marketName}
        </span>
      </div>

      <div>
        <span className="text-sm font-bold text-red-500">
          {formatPrice(order.total_price)}
        </span>
      </div>

      <div>
        {isAddressDelivery ? (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/30">
            <House size={11} className="text-orange-400" />
            <span className="text-[11px] text-orange-400 font-semibold">Uygacha</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-500/15 border border-slate-500/20">
            <Building2 size={11} className="text-slate-500 dark:text-white/70" />
            <span className="text-[11px] text-slate-600 dark:text-white/80 font-semibold">Markazgacha</span>
          </div>
        )}
      </div>

      <div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[11px] font-semibold text-slate-600 dark:text-white/80">
          {checked ? "Tanlangan" : "Tanlanmagan"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Calendar size={11} className="text-black dark:text-white/50 shrink-0" />
        <span className="text-[11px] text-black dark:text-white font-medium">
          {formatDate(order.updatedAt ?? order.createdAt)}
        </span>
      </div>

      <div
        className="flex justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hidden">
          <PrintModeSelect variant="icon" onSelect={(mode) => printOrders(mode, [order])} />
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${getStatusStyle(
            order.status as OrderStatus,
          )}`}
        >
          <Package2 size={11} />
          {getStatusLabel(order.status as OrderStatus)}
        </span>
      </div>
    </div>
  );
});

OrderRow.displayName = "OrderRow";

export default OrderRow;
