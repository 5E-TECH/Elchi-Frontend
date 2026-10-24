// dizayn-v2: (maket yo'q) superadmin-warehouse-detail
import { useMemo, useState } from "react";
import { History, SearchX } from "lucide-react";
import { useWarehouseMovements } from "../../../../entities/warehouse";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  QueryBoundary,
  Select,
  SkeletonList,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { PANEL_FOOT } from "../../model/classes";
import { useWarehouseText } from "../../model/useWarehouseText";
import { MovementItem } from "./MovementItem";

const PAGE_SIZES = [20, 50, 100] as const;

/** «Turi» filtri: Qaytdi — bekor (band bo'shadi) va qaytish birga. */
const TYPE_FILTERS = {
  IN: "IN",
  RESERVE: "RESERVE",
  OUT: "OUT",
  RETURN: "RETURN,RELEASE",
  ADJUST: "ADJUST",
} as const;
type TypeFilter = "" | keyof typeof TYPE_FILTERS;

/**
 * «HARAKATLAR» TABI — to'liq jurnal (`GET /warehouses/:id/movements`, eng yangisi tepada, sahifalab). Maket yo'q —
 * eng yaqini `superadmin-warehouse-detail` «Oxirgi harakatlar» (qator ko'rinishi AYNAN o'sha) + «Turi:» filtri
 * (Kirim · Band · Chiqim · Qaytdi · Tuzatish).
 */
export const MovementsPanel = ({ warehouseId }: { warehouseId: string }) => {
  const text = useWarehouseText();
  const { t } = text;
  const [type, setType] = useState<TypeFilter>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const query = useWarehouseMovements(warehouseId, { page, limit, ...(type ? { type: TYPE_FILTERS[type] } : {}) });
  const { data, isFetching } = query;

  const typeOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("list.all") },
      ...(Object.keys(TYPE_FILTERS) as (keyof typeof TYPE_FILTERS)[]).map((key) => ({
        value: key,
        label: t(`movement.type.${key}`),
      })),
    ],
    [t],
  );

  const total = data?.total ?? 0;
  return (
    <>
      <div role="group" aria-label={t("detail.movements.filtersLabel")} className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
        <Field label={t("detail.movements.typeFilter")} hideLabel labelAs="span" className="min-w-0 flex-[0_1_280px] max-md:basis-full">
          <Select
            options={typeOptions}
            value={type || null}
            onChange={(next) => {
              setType((next ?? "") as TypeFilter);
              setPage(1);
            }}
            placeholder={t("list.all")}
            inlineLabel={t("detail.movements.typeFilter")}
          />
        </Field>
      </div>
      <QueryBoundary
        query={{ ...query, data: data?.items }}
        loadingLabel={t("detail.movements.loading")}
        loading={<SkeletonList rows={5} />}
        empty={
          type ? (
            <EmptyState
              icon={SearchX}
              title={t("detail.movements.notFoundTitle")}
              action={
                <Button variant="secondary" onClick={() => setType("")}>
                  {t("list.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={History} title={t("detail.movements.emptyTitle")} description={t("detail.movements.emptyDescription")} />
          )
        }
        error={(error, retry) => <ErrorState error={error} title={t("detail.movements.loadFailed")} onRetry={retry} />}
      >
        {(items) => (
          <ul aria-label={t("detail.movements.listLabel")} aria-busy={isFetching || undefined} className="m-0 list-none border-t border-border p-0">
            {items.map((movement) => (
              <MovementItem key={movement.id} movement={movement} />
            ))}
          </ul>
        )}
      </QueryBoundary>
      {data && total > limit ? (
        <div className={PANEL_FOOT}>
          <Pagination
            page={data.page || page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            pageSizeOptions={PAGE_SIZES}
            disabled={isFetching}
            summary={(range) => t("detail.movements.pagination", range)}
          />
        </div>
      ) : null}
    </>
  );
};
