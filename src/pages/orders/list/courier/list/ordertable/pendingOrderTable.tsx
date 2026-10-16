// dizayn-v2: courier-orders-pending
import { memo } from "react";
import CourierOrdersTable from "./CourierOrdersTable";
import type { Order } from "./courierOrdersModel";

// Tur va holatlar umumiy modelda; eski importlar (`./ordertable/pendingOrderTable`) buzilmasin.
export { Order_status } from "./courierOrdersModel";
export type { Order } from "./courierOrdersModel";

type Props = {
  orders: Order[];
  /** Jadval/ro'yxat nomi (karta nomi: «Kutilayotgan buyurtmalar»). */
  label: string;
  busy?: boolean;
  onRowClick?: (order: Order) => void;
  onDeliver?: (order: Order) => void;
  onCancel?: (order: Order) => void;
};

/** «Kutilayotgan» tab: har qatorda «Sotish» va «Bekor qilish» (maket `courier-orders-pending`). */
const PendingOrdersTable = ({ orders, label, busy, onRowClick, onDeliver, onCancel }: Props) => (
  <CourierOrdersTable
    variant="pending"
    orders={orders}
    label={label}
    busy={busy}
    onRowClick={onRowClick}
    onDeliver={onDeliver}
    onCancel={onCancel}
  />
);

export default memo(PendingOrdersTable);
