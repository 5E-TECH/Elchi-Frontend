// dizayn-v2: courier-orders-all
import { memo } from "react";
import CourierOrdersTable from "./CourierOrdersTable";
import type { Order } from "./courierOrdersModel";

type Props = {
  orders: Order[];
  /** Jadval/ro'yxat nomi (karta nomi: «Barcha buyurtmalar»). */
  label: string;
  busy?: boolean;
  onRowClick?: (order: Order) => void;
  onDeliver?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  /** Yo'ldagi buyurtmani qabul qilish — «Sotish / Bekor» o'rniga «Qabul qilish» (2026-11-07). */
  onReceive?: (order: Order) => void;
  receivingIds?: ReadonlySet<string>;
  onRestore?: (order: Order) => void;
  /** Qatorda «Qayta tiklash» ko'rsatiladimi (berilmasa — sotilgan/bekor qilingan hammasida). */
  canRestore?: (order: Order) => boolean;
};

/**
 * «Barchasi» tab (maket `courier-orders-all`): yo'ldagi (pochtasi ma'lum) qatorda «Qabul qilish» (2026-11-07),
 * qolgan faol holatda «Sotish» + «Bekor qilish», sotilgan va
 * bekor qilinganda «Qayta tiklash» (fix3b LC-05: bekor qilinganda faqat posilka hali shu kuryerda
 * bo'lsa — `canRestore`), qolganlarida «—».
 */
const AllOrdersTable = ({
  orders,
  label,
  busy,
  onRowClick,
  onDeliver,
  onCancel,
  onRestore,
  canRestore,
  onReceive,
  receivingIds,
}: Props) => (
  <CourierOrdersTable
    variant="all"
    orders={orders}
    label={label}
    busy={busy}
    onRowClick={onRowClick}
    onDeliver={onDeliver}
    onCancel={onCancel}
    onReceive={onReceive}
    receivingIds={receivingIds}
    onRestore={onRestore}
    canRestore={canRestore}
  />
);

export default memo(AllOrdersTable);
