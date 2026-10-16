// dizayn-v2: courier-orders-cancelled
import { memo } from "react";
import CourierOrdersTable from "./CourierOrdersTable";
import { isUnsentCancelledOrder, type Order } from "./courierOrdersModel";

type Props = {
  orders: Order[];
  /** Jadval/ro'yxat nomi (karta nomi: «Pochtaga yuborilmagan bekor qilingan buyurtmalar»). */
  label: string;
  busy?: boolean;
  onRowClick?: (order: Order) => void;
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
};

/**
 * «Bekor qilingan» tab (maket `courier-orders-cancelled`): faqat pochtaga hali yuborilmagan bekor
 * buyurtmalar, har biri tanlanadi (pochtaga yuborish uchun), amallar ustuni yo'q.
 */
const CancelledOrdersTable = ({ orders, label, busy, onRowClick, selectedIds, onSelectChange, onSelectAll }: Props) => (
  <CourierOrdersTable
    variant="cancelled"
    orders={orders.filter(isUnsentCancelledOrder)}
    label={label}
    busy={busy}
    onRowClick={onRowClick}
    selection={{ selectedIds, onSelectChange, onSelectAll }}
  />
);

export default memo(CancelledOrdersTable);
