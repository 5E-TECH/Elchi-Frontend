// dizayn-v2: superadmin-warehouse-list, admin-warehouse-list, superadmin-warehouse-create-dialog, admin-warehouse-create-dialog
import { memo } from "react";
import { useSelector } from "react-redux";
import { canManageWarehouses } from "../../app/lib/access";
import { ManagerWarehouseRedirect } from "./ui/ManagerWarehouseRedirect";
import { WarehouseListView } from "./ui/WarehouseListView";

/**
 * «OMBOR» — `/warehouses` (yXC91RRx; guard `canViewWarehouses`). Superadmin va admin — omborlar ro'yxati
 * (`WarehouseListView`); filial menejeri — o'z filiali omboriga yo'naltiriladi (`ManagerWarehouseRedirect`).
 */
const WarehousesPage = () => {
  const canManage = useSelector(canManageWarehouses);
  return canManage ? <WarehouseListView /> : <ManagerWarehouseRedirect />;
};

export default memo(WarehousesPage);
