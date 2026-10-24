// dizayn-v2: superadmin-warehouse-list, admin-warehouse-list, superadmin-warehouse-create-dialog, admin-warehouse-create-dialog
import { memo } from "react";
import { useSelector } from "react-redux";
import { canManageWarehouses, canViewAllWarehouses } from "../../app/lib/access";
import { ManagerWarehouseRedirect } from "./ui/ManagerWarehouseRedirect";
import { WarehouseListView } from "./ui/WarehouseListView";

/**
 * «OMBOR» — `/warehouses` (yXC91RRx; guard `canViewWarehouses`). Superadmin va admin — omborlar ro'yxati
 * (`WarehouseListView`); registrator (XtcEyQjb) — o'sha ro'yxat, faqat ko'rish («Ombor ochish» yo'q); filial
 * menejeri — o'z filiali omboriga yo'naltiriladi (`ManagerWarehouseRedirect`).
 */
const WarehousesPage = () => {
  const canViewAll = useSelector(canViewAllWarehouses);
  const canManage = useSelector(canManageWarehouses);
  return canViewAll ? <WarehouseListView readOnly={!canManage} /> : <ManagerWarehouseRedirect />;
};

export default memo(WarehousesPage);
