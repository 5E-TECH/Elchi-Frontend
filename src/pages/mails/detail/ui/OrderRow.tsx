import { memo } from "react";
import {
  Phone,
  Store,
  User,
  MapPin,
  Home,
  Building2,
  Calendar,
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

const OrderRow = memo(({ order, checked, onToggle }: OrderRowProps) => (
  <div
    className={`group grid ${TABLE_COLS} items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${checked
      ? "bg-main/10 border-main/40"
      : "bg-white dark:bg-white/4 border-gray-100 dark:border-white/8 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-white/6"
      }`}
    onClick={() => onToggle(order.id)}
  >
    <Checkbox checked={checked} onChange={() => onToggle(order.id)} />

    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-main/10 dark:bg-main/20 shrink-0">
        <User size={13} className="text-main" />
      </div>
      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
        {order.customer?.name ?? "—"}
      </span>
    </div>

    <div className="flex items-center gap-1.5 min-w-0">
      <Phone size={12} className="text-black dark:text-white/50 shrink-0" />
      <span className="text-xs text-gray-500 dark:text-white font-medium truncate">
        {order.customer?.phone_number ?? "—"}
      </span>
    </div>

    <div className="flex items-center gap-1.5 min-w-0">
      <MapPin size={12} className="text-black dark:text-white/50 shrink-0" />
      <span className="text-xs text-gray-500 dark:text-white font-medium truncate">
        {order.district?.name ?? "—"} tumani
      </span>
    </div>

    <div className="flex items-center gap-1.5 min-w-0">
      <Store size={12} className="text-black dark:text-white/50 shrink-0" />
      <span className="text-xs text-gray-600 dark:text-white font-semibold truncate">
        {order.market?.name ?? "—"}
      </span>
    </div>

    <div>
      <span className="text-sm font-bold text-main">
        {formatPrice(order.total_price)}
      </span>
    </div>

    <div>
      {order.where_deliver === "address" ? (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/30">
          <Home size={11} className="text-orange-300" />
          <span className="text-[11px] text-orange-300 font-semibold">Manzilga</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30">
          <Building2 size={11} className="text-purple-300" />
          <span className="text-[11px] text-purple-300 font-semibold">Markazga</span>
        </div>
      )}
    </div>

    <div>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${getStatusStyle(
          order.status as OrderStatus,
        )}`}
      >
        {getStatusLabel(order.status as OrderStatus)}
      </span>
    </div>

    <div className="flex items-center gap-1.5">
      <Calendar size={11} className="text-black dark:text-white/50 shrink-0" />
      <span className="text-[11px] text-black dark:text-white font-medium">
        {formatDate(order.createdAt)}
      </span>
    </div>

    <div onClick={(e) => e.stopPropagation()}>
      <PrintModeSelect
        variant="icon"
        onSelect={(mode) => printOrders(mode, [order])}
      />
    </div>
  </div>
));

OrderRow.displayName = "OrderRow";

export default OrderRow;
