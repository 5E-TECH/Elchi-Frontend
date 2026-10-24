// dizayn-v2: superadmin-warehouse-list, admin-warehouse-list, superadmin-warehouse-create-dialog, admin-warehouse-create-dialog
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Package, Plus, SearchX, TriangleAlert, Warehouse as WarehouseIcon } from "lucide-react";
import { useWarehouseList, type Warehouse, type WarehouseStatus } from "../../../entities/warehouse";
import { useRegionLookup } from "../../../entities/region/lookup";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pagination,
  Pressable,
  QueryBoundary,
  Select,
  SkeletonTable,
  StatCard,
  StatusBadge,
  TextInput,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { CHIP, CHIP_COUNT } from "../model/classes";
import { useWarehouseText } from "../model/useWarehouseText";
import { CreateWarehouseDialog } from "./CreateWarehouseDialog";
import { warehousePath } from "../model/paths";
import { WarehousesTable } from "./WarehousesTable";

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;

type StatusFilter = "" | WarehouseStatus;

/**
 * OMBORLAR — `/warehouses` (superadmin, admin; maket `superadmin-warehouse-list` = admin).
 *
 * Sarlavha «Omborlar» + «Ombor ochish» (oyna `CreateWarehouseDialog`); 4 KPI (`summary` — filtrsiz hamma omborlar):
 * Omborlar · Jami dona · Band · Kam qolgan («N tasi tugagan»); karta: qidiruv (ombor, filial, mas'ul — `search`),
 * «Viloyat:» (`region_id`), holat chiplari «Barchasi · Faol · To'xtatilgan» (`counts` — viloyat/qidiruvdan keyin),
 * jadval (telefonda kartalar), pastda «N ta ombor · N ta faol · N ta to'xtatilgan» yoki sahifalash.
 * Maketdagi «Ombor ↑↓» saralash tugmasi chizilmagan — `GET /warehouses` da saralash parametri yo'q.
 */
export const WarehouseListView = () => {
  const text = useWarehouseText();
  const { t } = text;
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>("");
  const [regionId, setRegionId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const [createOpen, setCreateOpen] = useState(false);
  const searchTimer = useRef<number | undefined>(undefined);

  const commitSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    const next = value.trim();
    if (next !== search) {
      setSearch(next);
      setPage(1);
    }
  };
  const handleSearchInput = (value: string) => {
    setSearchText(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => commitSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const query = useWarehouseList({
    page,
    limit,
    ...(status ? { status } : {}),
    ...(regionId ? { region_id: regionId } : {}),
    ...(search ? { search } : {}),
  });
  const { data, isFetching, isPlaceholderData } = query;
  const summary = data?.summary;
  const counts = data?.counts;
  const filtersActive = Boolean(status || regionId || search);
  /** Umuman ombor yo'q (filtrsiz) — bo'sh holat ichida «Ombor ochish». */
  const noWarehouses = summary !== undefined && summary.warehouses === 0 && !filtersActive;

  const regionsQuery = useRegionLookup();
  const regionOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("list.all") },
      ...(regionsQuery.data ?? []).map((region) => ({ value: region.id, label: region.name })),
    ],
    [regionsQuery.data, t],
  );

  const statusChips: { value: StatusFilter; label: string; count: number | undefined }[] = [
    { value: "", label: t("list.all"), count: counts?.all },
    { value: "ACTIVE", label: t("status.active"), count: counts?.active },
    { value: "PAUSED", label: t("status.paused"), count: counts?.paused },
  ];

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchText("");
    setSearch("");
    setStatus("");
    setRegionId("");
    setPage(1);
  };

  const openCreate = () => setCreateOpen(true);
  const openWarehouse = (warehouse: Warehouse) => navigate(warehousePath(warehouse.id));

  const total = data?.total ?? 0;
  const footer =
    data && total > 0 ? (
      total > limit ? (
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
          summary={(range) => t("list.pagination", range)}
        />
      ) : (
        <span className="text-[13px] text-text-muted">
          {t("list.footer", {
            total: t("list.warehousesCount", { count: total, value: text.number(total) }),
            active: text.number(counts?.active ?? 0),
            paused: text.number(counts?.paused ?? 0),
          })}
        </span>
      )
    ) : undefined;

  const lowTotal = (summary?.lowCount ?? 0) + (summary?.outCount ?? 0);

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("list.title")}
        description={t("list.description")}
        actions={
          noWarehouses ? undefined : (
            <Button leftIcon={Plus} aria-haspopup="dialog" onClick={openCreate}>
              {t("create.open")}
            </Button>
          )
        }
      />

      <section aria-label={t("list.kpiLabel")} className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
        <StatCard
          label={t("kpi.warehouses")}
          icon={WarehouseIcon}
          loading={!summary}
          value={summary ? text.number(summary.warehouses) : undefined}
          unit={t("units.ta")}
          hint={
            summary
              ? t("kpi.warehousesHint", { active: text.number(summary.active), paused: text.number(summary.paused) })
              : undefined
          }
        />
        <StatCard
          label={t("kpi.onHand")}
          icon={Package}
          loading={!summary}
          value={summary ? text.number(summary.onHand) : undefined}
          unit={t("units.pcsWord", { count: summary?.onHand ?? 0 })}
          hint={
            summary
              ? t("kpi.onHandHint", {
                  positions: text.number(summary.positions),
                  warehouses: text.number(summary.warehouses),
                })
              : undefined
          }
        />
        <StatCard
          label={t("kpi.reserved")}
          icon={ClipboardList}
          loading={!summary}
          value={summary ? text.number(summary.reserved) : undefined}
          unit={t("units.pcsWord", { count: summary?.reserved ?? 0 })}
          hint={summary ? t("kpi.reservedHint", { value: text.number(summary.reservedOrders) }) : undefined}
        />
        <StatCard
          label={t("kpi.low")}
          icon={TriangleAlert}
          loading={!summary}
          value={summary ? text.number(lowTotal) : undefined}
          unit={t("units.ta")}
          hint={
            summary ? (
              <>
                {summary.outCount > 0 ? (
                  <StatusBadge
                    tone="danger"
                    label={t("kpi.outBadge", { count: summary.outCount, value: text.number(summary.outCount) })}
                  />
                ) : null}
                <span>{t("kpi.lowHint")}</span>
              </>
            ) : undefined
          }
        />
      </section>

      <Card padding="none" aria-label={t("list.cardLabel")} footer={noWarehouses ? undefined : footer}>
        {noWarehouses ? null : (
          <div
            role="group"
            aria-label={t("list.filtersLabel")}
            className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4"
          >
            <TextInput
              mode="search"
              value={searchText}
              onValueChange={handleSearchInput}
              onClear={() => commitSearch("")}
              onSearch={commitSearch}
              placeholder={t("list.searchPlaceholder")}
              aria-label={t("list.searchLabel")}
              className="min-w-0 flex-[6_1_260px]"
            />
            <Field
              label={t("list.regionFilter")}
              hideLabel
              labelAs="span"
              className="min-w-0 flex-[1_1_200px] max-md:basis-full"
            >
              <Select
                options={regionOptions}
                value={regionId || null}
                onChange={(next) => {
                  setRegionId(next ?? "");
                  setPage(1);
                }}
                searchable
                placeholder={t("list.all")}
                inlineLabel={t("list.regionFilter")}
                loading={regionsQuery.isLoading}
              />
            </Field>
            <div role="group" aria-label={t("list.statusFilter")} className="flex flex-[0_1_auto] flex-wrap gap-2">
              {statusChips.map((chip) => (
                <Pressable
                  key={chip.value || "all"}
                  aria-pressed={status === chip.value}
                  className={CHIP}
                  onClick={() => {
                    setStatus(chip.value);
                    setPage(1);
                  }}
                >
                  {chip.label}
                  {chip.count !== undefined ? <span className={CHIP_COUNT}>{text.number(chip.count)}</span> : null}
                </Pressable>
              ))}
            </div>
          </div>
        )}

        <QueryBoundary
          query={{ ...query, data: data?.items }}
          loadingLabel={t("list.loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[t("list.columns.warehouse"), t("list.columns.onHand"), t("list.columns.low"), t("list.columns.status")]}
              rows={4}
            />
          }
          empty={
            noWarehouses ? (
              <EmptyState
                icon={WarehouseIcon}
                title={t("list.emptyTitle")}
                description={t("list.emptyDescription")}
                action={
                  <Button leftIcon={Plus} aria-haspopup="dialog" onClick={openCreate}>
                    {t("create.open")}
                  </Button>
                }
              />
            ) : isPlaceholderData ? (
              <SkeletonTable framed={false} columns={[t("list.columns.warehouse"), t("list.columns.onHand")]} rows={3} />
            ) : (
              <EmptyState
                icon={SearchX}
                title={t("list.notFoundTitle")}
                description={t("list.notFoundDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t("list.clearFilters")}
                  </Button>
                }
              />
            )
          }
          error={(error, retry) => <ErrorState error={error} title={t("list.loadFailed")} onRetry={retry} />}
        >
          {(rows) => (
            <WarehousesTable
              rows={rows}
              busy={isFetching && isPlaceholderData}
              onOpen={openWarehouse}
            />
          )}
        </QueryBoundary>
      </Card>

      <CreateWarehouseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(warehouse) => {
          setCreateOpen(false);
          if (warehouse) navigate(warehousePath(warehouse.id));
        }}
      />
    </div>
  );
};
