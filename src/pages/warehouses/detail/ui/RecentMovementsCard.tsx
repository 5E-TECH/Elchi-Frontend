// dizayn-v2: superadmin-warehouse-detail, admin-warehouse-detail, manager-warehouse-detail
import { useId } from "react";
import { ArrowRight, History } from "lucide-react";
import { useWarehouseMovements } from "../../../../entities/warehouse";
import { Button, Card, EmptyState, ErrorState, QueryBoundary, SkeletonList } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";
import { MovementItem } from "./MovementItem";

export const RECENT_MOVEMENTS_LIMIT = 5;

/**
 * «OXIRGI HARAKATLAR» (maket `superadmin-warehouse-detail` = admin, menejer): «Kirim, band, chiqim, qaytish va
 * tuzatishlar», so'nggi 5 ta yozuv; «Barchasi →» — «Harakatlar» tabiga o'tadi.
 */
export const RecentMovementsCard = ({ warehouseId, onShowAll }: { warehouseId: string; onShowAll: () => void }) => {
  const { t } = useWarehouseText();
  const titleId = useId();
  const query = useWarehouseMovements(warehouseId, { page: 1, limit: RECENT_MOVEMENTS_LIMIT });
  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby={titleId}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 max-md:px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="m-0 text-base font-bold text-text">
            {t("detail.recent.title")}
          </h2>
          <p className="m-0 text-[13px] text-text-muted">{t("detail.recent.description")}</p>
        </div>
        <Button variant="ghost" size="sm" rightIcon={ArrowRight} onClick={onShowAll}>
          {t("detail.recent.showAll")}
        </Button>
      </div>
      <QueryBoundary
        query={{ ...query, data: query.data?.items }}
        loadingLabel={t("detail.movements.loading")}
        loading={<SkeletonList rows={3} />}
        empty={<EmptyState icon={History} title={t("detail.movements.emptyTitle")} description={t("detail.movements.emptyDescription")} />}
        error={(error, retry) => <ErrorState error={error} title={t("detail.movements.loadFailed")} onRetry={retry} />}
      >
        {(items) => (
          <ul aria-labelledby={titleId} className="m-0 list-none border-t border-border p-0">
            {items.map((movement) => (
              <MovementItem key={movement.id} movement={movement} />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
};
