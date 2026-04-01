import { memo } from "react";
import {
  Phone,
  Store,
  User,
  MapPin,
  Building2,
  Calendar,
  Package2,
  Warehouse,
  House,
} from "lucide-react";
import type { PostOrder, OrderStatus } from "../../../../entities/mails";
import { formatDate, formatPrice, getStatusLabel, getStatusStyle } from "../lib/helpers";
import Checkbox from "./Checkbox";
import { HISTORY_TABLE_COLS, TABLE_COLS } from "./OrdersTable";

interface OrderRowProps {
  order: PostOrder;
  checked: boolean;
  onToggle: (id: string) => void;
  variant?: "default" | "history";
  readOnly?: boolean;
}

const OrderRow = memo(({ order, checked, onToggle, variant = "default", readOnly = false }: OrderRowProps) => {
  const customerName = order.customer?.name ?? `Mijoz #${order.customer_id}`;
  const customerPhone = order.customer?.phone_number ?? "Telefon yo'q";
  const districtName = order.district?.name ?? `Tuman #${order.district_id}`;
  const marketName = order.market?.name ?? `Market #${order.market_id}`;
  const isAddressDelivery = order.where_deliver === "address";
  const locationLabel = order.address?.trim() || districtName;
  const isHistory = variant === "history";

  if (isHistory) {
    return (
      <div className="rounded-[22px] border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/8 dark:bg-white/[0.03]">
        <div className={`hidden xl:grid ${HISTORY_TABLE_COLS} items-center gap-4 px-6 py-4`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 shrink-0">
              <User size={14} className="text-slate-500 dark:text-white/70" />
            </div>
            <span className="text-[15px] font-semibold text-slate-800 dark:text-white truncate">
              {customerName}
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-white/75">
            <Phone size={14} className="shrink-0" />
            <span className="text-sm font-medium truncate">{customerPhone}</span>
          </div>

          <div className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-white/75">
            <MapPin size={14} className="shrink-0" />
            <span className="text-sm font-medium truncate">{locationLabel}</span>
          </div>

          <div className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-white/75">
            <Store size={14} className="shrink-0" />
            <span className="text-sm font-medium truncate">{marketName}</span>
          </div>

          <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
            {formatPrice(order.total_price)}
          </div>

          <div>
            {isAddressDelivery ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/20">
                <House size={12} />
                <span className="text-xs font-semibold">Uygacha</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-400/20">
                <Warehouse size={12} />
                <span className="text-xs font-semibold">Markazgacha</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-600 dark:text-white/75 whitespace-nowrap">
            <Calendar size={14} className="shrink-0" />
            <span className="text-sm font-medium">{formatDate(order.updatedAt ?? order.createdAt).slice(0, 10)}</span>
          </div>
        </div>

        <div className="xl:hidden px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <User size={15} className="text-slate-500 dark:text-white/70" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="m-0 break-words text-sm font-extrabold text-slate-800 dark:text-white">
                {customerName}
              </p>
              <p className="m-0 mt-1 flex items-center gap-1.5 break-all text-[12px] text-slate-600 dark:text-white/75">
                <Phone size={12} className="shrink-0" />
                {customerPhone}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 dark:bg-white/10 text-[11px] font-semibold text-slate-600 dark:text-white/80">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </span>

            <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 dark:bg-white/10 text-[11px] font-semibold text-slate-600 dark:text-white/80">
              <Store size={11} className="shrink-0" />
              <span className="truncate">{marketName}</span>
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatPrice(order.total_price)}
            </span>

            <span className="inline-flex items-center gap-1.5 break-words text-[12px] text-slate-600 dark:text-white/75">
              <Calendar size={12} className="shrink-0" />
              {formatDate(order.updatedAt ?? order.createdAt).slice(0, 10)}
            </span>

            {isAddressDelivery ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600 dark:border-orange-400/20 dark:bg-orange-500/15 dark:text-orange-300">
                <House size={12} />
                Uygacha
              </span>
            ) : (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-fuchsia-100 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-600 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-300">
                <Warehouse size={12} />
                Markazgacha
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group rounded-xl border transition-all duration-200 cursor-pointer ${
        checked
          ? "bg-main/10 border-main/40 shadow-sm"
          : "bg-white dark:bg-white/4 border-gray-100 dark:border-white/8 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-white/6"
      }`}
      onClick={() => {
        if (!readOnly) onToggle(order.id);
      }}
    >
      {/* XL table layout */}
      <div className={`hidden xl:grid ${TABLE_COLS} items-center gap-2 xl:gap-3 px-3 xl:px-4 py-3.5`}>
        {readOnly ? <div /> : <Checkbox checked={checked} onChange={() => onToggle(order.id)} />}

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

        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Calendar size={11} className="text-black dark:text-white/50 shrink-0" />
          <span className="text-[11px] text-black dark:text-white font-medium">
            {formatDate(order.updatedAt ?? order.createdAt)}
          </span>
        </div>

        <div className="flex justify-end">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${getStatusStyle(
              order.status as OrderStatus,
            )}`}
            style={{ whiteSpace: "nowrap" }}
          >
            <Package2 size={11} />
            {getStatusLabel(order.status as OrderStatus)}
          </span>
        </div>
      </div>

      {/* Compact layout (no horizontal scroll) */}
      <div className="xl:hidden px-3 py-3.5">
        <div className="flex items-start gap-3">
          {readOnly ? null : (
            <div className="pt-0.5">
              <Checkbox checked={checked} onChange={() => onToggle(order.id)} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 break-words text-sm font-extrabold text-gray-900 dark:text-white sm:truncate">
                  {customerName}
                </p>
                <p className="m-0 mt-1 flex items-center gap-1.5 break-all text-[12px] text-gray-500 dark:text-white/70 sm:truncate">
                  <Phone size={12} className="shrink-0 text-gray-400 dark:text-white/40" />
                  {customerPhone}
                </p>
              </div>

              <span
                className={`inline-flex w-fit items-center gap-1 self-start rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${getStatusStyle(
                  order.status as OrderStatus,
                )}`}
                style={{ whiteSpace: "nowrap" }}
              >
                <Package2 size={11} />
                {getStatusLabel(order.status as OrderStatus)}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <span className="text-sm font-bold text-red-500">
                {formatPrice(order.total_price)}
              </span>

              <span className="inline-flex items-center gap-1.5 break-words text-[12px] text-gray-500 dark:text-white/70">
                <Calendar size={12} className="shrink-0 text-gray-400 dark:text-white/40" />
                {formatDate(order.updatedAt ?? order.createdAt)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 dark:bg-white/10 text-[11px] font-semibold text-slate-600 dark:text-white/80">
                <Store size={11} className="shrink-0" />
                <span className="truncate">{marketName}</span>
              </span>

              <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 dark:bg-white/10 text-[11px] font-semibold text-slate-600 dark:text-white/80">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{districtName}</span>
              </span>

              {isAddressDelivery ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/15 px-2 py-1 text-[11px] font-semibold text-orange-500">
                  <House size={11} />
                  Uygacha
                </span>
              ) : (
                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-500/20 bg-slate-500/15 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-white/80">
                  <Warehouse size={11} />
                  Markazgacha
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

OrderRow.displayName = "OrderRow";

export default OrderRow;
