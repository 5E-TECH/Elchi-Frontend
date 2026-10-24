// dizayn-v2: (maket yo'q) manager-warehouse-detail
import { Navigate } from "react-router-dom";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { useWarehouseList } from "../../../entities/warehouse";
import { EmptyState, ErrorState, PageHeader, SkeletonLines } from "../../../shared/ui/primitives";
import { warehousePath } from "../model/paths";
import { useWarehouseText } from "../model/useWarehouseText";

/**
 * FILIAL MENEJERI — «Ombor» bandi (`/warehouses`). Backend menejerga faqat o'z filiali omborini qaytaradi: bitta
 * bo'lsa — darhol uning tafsilotiga (`/warehouses/:id`, maket `manager-warehouse-detail`); filialda ombor hali
 * ochilmagan bo'lsa — «Filialingizda ombor yo'q» (maket yo'q — eng yaqini `manager-warehouse-detail`).
 */
export const ManagerWarehouseRedirect = () => {
  const { t } = useWarehouseText();
  const query = useWarehouseList({ limit: 1 });
  const first = query.data?.items[0];

  if (first) return <Navigate to={warehousePath(first.id)} replace />;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("manager.title")} />
      {query.isError ? (
        <ErrorState error={query.error} title={t("detail.loadFailed")} onRetry={() => void query.refetch()} size="page" />
      ) : query.isLoading || !query.data ? (
        <SkeletonLines lines={4} />
      ) : (
        <EmptyState
          framed
          size="page"
          icon={WarehouseIcon}
          title={t("manager.emptyTitle")}
          description={t("manager.emptyDescription")}
        />
      )}
    </div>
  );
};
