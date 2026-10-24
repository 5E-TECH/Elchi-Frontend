// dizayn-v2: market-products-warehouse-stock
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Info, Package, SearchX, Tag, TriangleAlert, Warehouse as WarehouseIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  STOCK_LEVEL_TONE,
  useMarketWarehouseStock,
  type MarketStockCell,
  type MarketStockRow,
} from "../../../entities/warehouse";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Pressable,
  QueryBoundary,
  SkeletonTable,
  StatCard,
  StatusBadge,
  TextInput,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { MarketProductsTabs } from "./MarketProductsTabs";
import { MARKET_WAREHOUSE_VIEW, shortWarehouseName } from "./marketStockView";

const PAGE_SIZES = [50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;
const TOTALS_KEY = "__totals__";

/** `.el-chip` (`aria-pressed`, CODE-MAP 2.2). */
const CHIP =
  "inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color] duration-150 hover:border-text-subtle " +
  "motion-reduce:transition-none aria-pressed:border-action aria-pressed:bg-action-soft aria-pressed:font-semibold " +
  "aria-pressed:text-action-fg max-md:h-11";
const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

type Row = MarketStockRow | { totals: true };
const isTotals = (row: Row): row is { totals: true } => "totals" in row;

/**
 * MARKET «OMBORDAGI QOLDIQ» — `/products?view=warehouse` (faqat market; maket `market-products-warehouse-stock`).
 *
 * Sarlavha (mahsulotlar ro'yxati bilan bir xil) + tablar; 3 KPI (Omborlardagi jami dona — faqat faol omborlar,
 * Omborlar soni, Kam qolgan); «Faqat ko'rish» izohi; karta: qidiruv, «Faqat kam qolganlar» chipi, izoh qatori;
 * jadval «Mahsulot · <har ombor> · Jami» (to'xtatilgan ombor ustuni kulrang, sarlavhada «To'xtatilgan»; katakda
 * mavjud dona, kam qolgan — «7 · kam qoldi», tugagan — «0 · tugagan», omborda yo'q — «—»; «Jami» faqat faol
 * omborlar), pastda «Jami, dona» qatori (ro'yxat bitta sahifaga sig'sa); telefonda kartalar (har ombor — qator).
 * So'rov: `GET /market/warehouse-stock?search&low_only&page&limit` (market — token bo'yicha o'zi).
 */
export const MarketWarehouseStock = ({
  description,
  productsTotal,
}: {
  description: ReactNode;
  productsTotal?: number;
}) => {
  const { t, i18n } = useTranslation(["warehouses", "products"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language });
  const isPhone = useIsPhone();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const searchTimer = useRef<number | undefined>(undefined);

  const commitSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    const next = value.trim();
    if (next !== search) {
      setSearch(next);
      setPage(1);
    }
  };

  const query = useMarketWarehouseStock({ page, limit, ...(search ? { search } : {}), ...(lowOnly ? { low_only: true } : {}) });
  const { data, isFetching, isPlaceholderData } = query;
  const summary = data?.summary;
  const warehouses = useMemo(() => data?.warehouses ?? [], [data?.warehouses]);
  const filtersActive = Boolean(search || lowOnly);
  /** «Jami, dona» qatori — faqat butun ro'yxat shu sahifada bo'lsa (aks holda yolg'on yig'indi). */
  const complete = Boolean(data && data.items.length > 0 && data.total <= data.items.length && !isPhone);

  const cellOf = (row: MarketStockRow, warehouseId: string) => row.cells.find((cell) => cell.warehouseId === warehouseId);
  const columnTotal = (warehouseId: string) =>
    (data?.items ?? []).reduce((sum, row) => sum + (cellOf(row, warehouseId)?.available ?? 0), 0);

  const missing = (
    <span title={t("market.notInWarehouse")} className="text-text-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("market.notInWarehouse")}</span>
    </span>
  );

  const cellView = (cell: MarketStockCell | undefined, paused: boolean) => {
    if (!cell) return missing;
    if (paused) return <span className="text-text-subtle">{number(cell.available)}</span>;
    if (cell.level === "out" || cell.level === "low") {
      return (
        <StatusBadge
          tone={STOCK_LEVEL_TONE[cell.level]}
          label={t(cell.level === "out" ? "market.cellOut" : "market.cellLow", { value: number(cell.available) })}
        />
      );
    }
    return number(cell.available);
  };

  const columns: DataTableColumn<Row>[] = [
      {
        id: "product",
        header: t("market.columns.product"),
        cell: (row) =>
          isTotals(row) ? (
            <span className="font-semibold text-text">{t("market.totalsRow")}</span>
          ) : (
            <span className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className={cx(STAT_ICON, "max-lg:hidden")}>
                <Tag size={18} strokeWidth={2} />
              </span>
              <span className="font-semibold text-text">{row.product.name}</span>
            </span>
          ),
      },
      ...warehouses.map<DataTableColumn<Row>>((warehouse) => {
        const paused = warehouse.status === "PAUSED";
        return {
          id: `wh-${warehouse.id}`,
          header: (
            <span title={warehouse.name} className="inline-flex flex-col items-end gap-1">
              {shortWarehouseName(warehouse)}
              {paused ? (
                <StatusBadge tone="neutral" label={t("status.paused")} className="normal-case tracking-normal" />
              ) : null}
            </span>
          ),
          align: "end",
          headerClassName: paused ? "bg-sunken" : undefined,
          cellClassName: paused ? "bg-sunken" : undefined,
          cell: (row) =>
            isTotals(row) ? (
              <span className={cx("font-semibold", paused ? "text-text-subtle" : "text-text")} title={paused ? t("market.notCounted") : undefined}>
                {number(columnTotal(warehouse.id))}
              </span>
            ) : (
              cellView(cellOf(row, warehouse.id), paused)
            ),
        };
      }),
      {
        id: "total",
        header: <span title={t("market.columns.totalTitle")}>{t("market.columns.total")}</span>,
        align: "end",
        cell: (row) => (
          <span className="font-semibold text-text">
            {number(isTotals(row) ? (summary?.totalAvailable ?? 0) : row.totalAvailable)}
          </span>
        ),
      },
  ];

  const renderCard = (row: Row) => {
    if (isTotals(row)) return null;
    return (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className={STAT_ICON}>
              <Tag size={18} strokeWidth={2} />
            </span>
            <span className="font-semibold text-text">{row.product.name}</span>
          </span>
          <span className="whitespace-nowrap font-semibold text-text">
            {t("units.pcs", { count: row.totalAvailable, value: number(row.totalAvailable) })}
          </span>
        </span>
        <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-[10px] bg-sunken px-3 py-2">
          {warehouses.map((warehouse) => (
            <div key={warehouse.id} className="contents">
              <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-muted">
                {shortWarehouseName(warehouse)}
                {warehouse.status === "PAUSED" ? <StatusBadge tone="neutral" label={t("status.paused")} /> : null}
              </dt>
              <dd className="m-0 text-right text-[13px] font-semibold">
                {cellView(cellOf(row, warehouse.id), warehouse.status === "PAUSED")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const rows: Row[] | undefined = data ? (complete ? [...data.items, { totals: true }] : data.items) : undefined;
  const total = data?.total ?? 0;
  const lowTotal = (summary?.lowPositions ?? 0) + (summary?.outPositions ?? 0);

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title", { ns: "products" })} description={description}>
        <MarketProductsTabs value={MARKET_WAREHOUSE_VIEW} productsTotal={productsTotal} />
      </PageHeader>

      <section aria-label={t("market.kpiLabel")} className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-md:gap-3">
        <StatCard
          label={t("market.kpi.available")}
          icon={Package}
          loading={!summary}
          value={summary ? number(summary.totalAvailable) : undefined}
          unit={t("units.pcsWord", { count: summary?.totalAvailable ?? 0 })}
          hint={summary ? t("market.kpi.availableHint", { value: number(summary.activeWarehousesWithStock) }) : undefined}
          className="max-md:col-span-2"
        />
        <StatCard
          label={t("market.kpi.warehouses")}
          icon={WarehouseIcon}
          loading={!summary}
          value={summary ? number(summary.warehousesTotal) : undefined}
          unit={t("units.ta")}
          hint={
            summary
              ? t("kpi.warehousesHint", { active: number(summary.warehousesActive), paused: number(summary.warehousesPaused) })
              : undefined
          }
        />
        <StatCard
          label={t("kpi.low")}
          icon={TriangleAlert}
          loading={!summary}
          value={summary ? number(lowTotal) : undefined}
          unit={t("units.ta")}
          hint={
            summary ? (
              <>
                {summary.outPositions > 0 ? (
                  <StatusBadge
                    tone="danger"
                    label={t("kpi.outBadge", { count: summary.outPositions, value: number(summary.outPositions) })}
                  />
                ) : null}
                <span>{t("kpi.lowHint")}</span>
              </>
            ) : undefined
          }
        />
      </section>

      <div role="note" className="flex min-w-0 items-start gap-3 rounded-xl bg-info-soft px-4 py-3 text-sm">
        <Info size={18} aria-hidden="true" className="mt-px shrink-0 text-info-fg" />
        <span className="flex min-w-0 flex-col gap-1 text-text">
          <span className="font-bold">{t("market.noteTitle")}</span>
          <span className="text-[13px] leading-[18px]">{t("market.noteText")}</span>
        </span>
      </div>

      <Card
        padding="none"
        aria-label={t("market.cardLabel")}
        footer={
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
                summary={(range) => t("market.pagination", range)}
              />
            ) : (
              <span className="text-[13px] text-text-muted">
                {summary
                  ? t("market.footer", { total: number(summary.productsTotal), stocked: number(summary.productsInWarehouses) })
                  : null}
              </span>
            )
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 max-md:px-4">
          <TextInput
            mode="search"
            value={searchText}
            onValueChange={(value) => {
              setSearchText(value);
              window.clearTimeout(searchTimer.current);
              searchTimer.current = window.setTimeout(() => commitSearch(value), SEARCH_DEBOUNCE_MS);
            }}
            onClear={() => commitSearch("")}
            onSearch={commitSearch}
            placeholder={t("market.searchPlaceholder")}
            aria-label={t("market.searchLabel")}
            className="min-w-0 flex-[10_1_280px]"
          />
          <Pressable
            aria-pressed={lowOnly}
            className={CHIP}
            onClick={() => {
              setLowOnly((value) => !value);
              setPage(1);
            }}
          >
            <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />
            {t("market.lowOnly")}
          </Pressable>
          <p className="m-0 basis-full text-[13px] text-text-muted">{t("market.hint")}</p>
        </div>
        <QueryBoundary
          query={{ ...query, data: rows }}
          loadingLabel={t("market.loading")}
          loading={<SkeletonTable framed={false} columns={[t("market.columns.product"), t("market.columns.total")]} rows={5} />}
          empty={
            filtersActive ? (
              <EmptyState
                icon={SearchX}
                title={t("detail.stock.notFoundTitle")}
                description={t("detail.stock.notFoundDescription")}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchText("");
                      setSearch("");
                      setLowOnly(false);
                      setPage(1);
                    }}
                  >
                    {t("list.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={WarehouseIcon} title={t("market.emptyTitle")} description={t("market.emptyDescription")} />
            )
          }
          error={(error, retry) => <ErrorState error={error} title={t("market.loadFailed")} onRetry={retry} />}
        >
          {(list) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(row) => (isTotals(row) ? TOTALS_KEY : row.product.id)}
              label={t("market.tableLabel")}
              cardsLabel={t("market.tableLabel")}
              renderCard={renderCard}
              rowClassName={(row) => (isTotals(row) ? "bg-sunken hover:bg-sunken" : false)}
              busy={isFetching && isPlaceholderData}
              className="border-t border-border"
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};
