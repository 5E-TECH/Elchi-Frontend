// dizayn-v2: superadmin-warehouse-detail, admin-warehouse-detail, manager-warehouse-detail
import { useMemo, useRef, useState } from "react";
import { ArrowUp, PackagePlus, SearchX, Tag } from "lucide-react";
import {
  ProductCodeTag,
  StockLevelBadge,
  useWarehouseStock,
  type StockLevel,
  type WarehouseStockRow,
} from "../../../../entities/warehouse";
import { formatKgValue } from "../../../../entities/delivery-pricing";
import { cx } from "../../../../shared/lib/cx";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  Pressable,
  QueryBoundary,
  Select,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { PANEL_FOOT, STAT_ICON } from "../../model/classes";
import { useWarehouseText } from "../../model/useWarehouseText";

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;

const AVAILABLE_TONE: Record<StockLevel, string> = { ok: "text-text", low: "text-warning-fg", out: "text-danger-fg" };

export type StockFilters = { search: string; marketId: string; level: "" | StockLevel };

export type StockPanelProps = {
  warehouseId: string;
  /** Superadmin / admin: chegarani o'zgartirish va bo'sh holatdagi «Mahsulot qo'shish». */
  canManage: boolean;
  /** Ombordagi jami dona (bitta sahifali xulosa uchun: «5 ta pozitsiya · 96 dona»). */
  onHandTotal: number | undefined;
  onEditThreshold: (row: WarehouseStockRow) => void;
  onAddStock: () => void;
  /** XtcEyQjb: to'xtatilgan ombor — bo'sh holatdagi «Mahsulot qo'shish» ham o'chiq. */
  addStockDisabled?: boolean;
  /** Joriy filtrlar (Excel eksporti shu filtrlar bilan). */
  onFiltersChange?: (filters: StockFilters) => void;
};

/**
 * «QOLDIQ» TABI (maket `superadmin-warehouse-detail` = admin, menejer): qidiruv (nom, ELC-P kodi yoki shtrix kod),
 * «Market:» (`facets.markets`), «Holat:» (Yetarli · Kam qoldi · Tugagan, sonlari `facets.levels`); jadval «Mahsulot ·
 * Kod · Market · Qoldiq · Band · Mavjud ↑ · Chegara · Hisob vazni · Holat» (saralash — server: mavjud o'sishi
 * bo'yicha; planshetda kod, market, band, chegara, hisob vazni yashirin — market · kod nom ostida), telefonda
 * kartalar. Superadmin/admin uchun «Chegara» bosiladi — `ThresholdDialog` (maketda tugma ko'rinmaydi — qo'shimcha).
 */
export const StockPanel = ({
  warehouseId,
  canManage,
  onHandTotal,
  onEditThreshold,
  onAddStock,
  addStockDisabled = false,
  onFiltersChange,
}: StockPanelProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<StockFilters>({ search: "", marketId: "", level: "" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const searchTimer = useRef<number | undefined>(undefined);

  const applyFilters = (patch: Partial<StockFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    onFiltersChange?.(next);
  };
  const commitSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    if (value.trim() !== filters.search) applyFilters({ search: value.trim() });
  };

  const query = useWarehouseStock(warehouseId, {
    page,
    limit,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.marketId ? { market_id: filters.marketId } : {}),
    ...(filters.level ? { level: filters.level } : {}),
  });
  const { data, isFetching, isPlaceholderData } = query;
  const filtersActive = Boolean(filters.search || filters.marketId || filters.level);

  const marketOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("list.all") },
      ...(data?.facets.markets ?? []).map((market) => ({
        value: market.id,
        label: market.name ?? `#${market.id}`,
        description: t("detail.stock.marketPositions", { count: market.positions, value: text.number(market.positions) }),
      })),
    ],
    [data?.facets.markets, t, text],
  );
  const levelOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("list.all") },
      ...(["ok", "low", "out"] as const).map((level) => ({
        value: level,
        label: t(`level.${level}`),
        description: data ? text.number(data.facets.levels[level]) : undefined,
      })),
    ],
    [data, t, text],
  );

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchText("");
    applyFilters({ search: "", marketId: "", level: "" });
  };

  const weight = (row: WarehouseStockRow) => {
    if (row.product.measureMissing || row.product.chargeableWeightKg === null) {
      return { value: null, basis: null };
    }
    return {
      value: t("units.kg", { value: formatKgValue(row.product.chargeableWeightKg, text.language) }),
      basis: row.product.chargeableBasis === "volumetric" ? t("detail.stock.byVolume") : null,
    };
  };

  const thresholdCell = (row: WarehouseStockRow, compact = false) => {
    const value = text.number(row.threshold);
    if (!canManage) {
      return compact ? t("detail.stock.thresholdShort", { value }) : <span className="text-text-muted">{value}</span>;
    }
    // Maketdagidek kulrang son; bosiladi (nuqtali tagchiziq — tahrirlanadi) → «Kam qoldiq chegarasi» oynasi.
    return (
      <Pressable
        onClick={() => onEditThreshold(row)}
        aria-label={t("detail.stock.thresholdEditAria", { name: row.product.name, value })}
        title={t("detail.stock.thresholdEditTitle")}
        className="rounded-sm text-text-muted underline decoration-dotted underline-offset-4 hover:text-action-fg max-md:inline-flex max-md:min-h-11 max-md:items-center"
      >
        {compact ? t("detail.stock.thresholdShort", { value }) : value}
      </Pressable>
    );
  };

  const columns: DataTableColumn<WarehouseStockRow>[] = [
    {
      id: "product",
      header: t("detail.stock.columns.product"),
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={STAT_ICON}>
            <Tag size={18} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="whitespace-nowrap font-semibold text-text">{row.product.name}</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-text-muted lg:hidden">
              {row.market.name}
              {row.product.code.value ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{row.product.code.value}</span>
                </>
              ) : null}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "code",
      header: <span title={t("detail.stock.columns.codeTitle")}>{t("detail.stock.columns.code")}</span>,
      hideBelow: "lg",
      cell: (row) => <ProductCodeTag code={row.product.code} />,
    },
    {
      id: "market",
      header: t("detail.stock.columns.market"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => row.market.name ?? "—",
    },
    {
      id: "onHand",
      header: <span title={t("detail.stock.columns.onHandTitle")}>{t("detail.stock.columns.onHand")}</span>,
      align: "end",
      cell: (row) => text.number(row.onHand),
    },
    {
      id: "reserved",
      header: <span title={t("detail.stock.columns.reservedTitle")}>{t("detail.stock.columns.reserved")}</span>,
      align: "end",
      hideBelow: "lg",
      cell: (row) => text.number(row.reserved),
    },
    {
      id: "available",
      header: (
        <span title={t("detail.stock.columns.availableTitle")} className="inline-flex items-center gap-1 text-text">
          {t("detail.stock.columns.available")}
          <ArrowUp size={14} aria-hidden="true" />
          <span className="sr-only">{t("detail.stock.sortedAsc")}</span>
        </span>
      ),
      align: "end",
      cell: (row) => <span className={cx("font-semibold", AVAILABLE_TONE[row.level])}>{text.number(row.available)}</span>,
    },
    {
      id: "threshold",
      header: <span title={t("detail.stock.columns.thresholdTitle")}>{t("detail.stock.columns.threshold")}</span>,
      align: "end",
      hideBelow: "lg",
      cell: (row) => thresholdCell(row),
    },
    {
      id: "weight",
      header: <span title={t("detail.stock.columns.weightTitle")}>{t("detail.stock.columns.weight")}</span>,
      align: "end",
      hideBelow: "lg",
      cell: (row) => {
        const value = weight(row);
        if (!value.value) return <span className="whitespace-nowrap text-[13px] text-warning-fg">{t("detail.stock.noMeasure")}</span>;
        return (
          <span className="flex flex-col items-end gap-0.5 whitespace-nowrap">
            <span>{value.value}</span>
            {value.basis ? <span className="text-[13px] text-text-muted">{value.basis}</span> : null}
          </span>
        );
      },
    },
    {
      id: "level",
      header: t("detail.stock.columns.level"),
      cell: (row) => <StockLevelBadge level={row.level} />,
    },
  ];

  const renderCard = (row: WarehouseStockRow) => {
    const value = weight(row);
    return (
      <div className="flex min-w-0 items-start gap-3 px-4 py-3">
        <span aria-hidden="true" className={STAT_ICON}>
          <Tag size={18} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 font-semibold text-text">{row.product.name}</span>
            <StockLevelBadge level={row.level} className="shrink-0" />
          </span>
          <span className="flex flex-wrap items-center gap-x-1 text-[13px] text-text-muted">
            {row.market.name}
            <span aria-hidden="true">·</span>
            {thresholdCell(row, true)}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <ProductCodeTag code={row.product.code} />
            <span className="text-xs text-text-muted">
              {value.value
                ? t("detail.stock.weightLine", { value: value.basis ? `${value.value} · ${value.basis}` : value.value })
                : t("detail.stock.noMeasure")}
            </span>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            <span>
              <span className="text-text-muted">{t("detail.stock.columns.onHand")}</span>{" "}
              <span className="font-semibold text-text">{text.number(row.onHand)}</span>
            </span>
            <span>
              <span className="text-text-muted">{t("detail.stock.columns.reserved")}</span>{" "}
              <span className="font-semibold text-text">{text.number(row.reserved)}</span>
            </span>
            <span>
              <span className="text-text-muted">{t("detail.stock.columns.available")}</span>{" "}
              <span className={cx("font-semibold", AVAILABLE_TONE[row.level])}>{text.number(row.available)}</span>
            </span>
          </span>
        </span>
      </div>
    );
  };

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
          summary={(range) => t("detail.stock.pagination", range)}
        />
      ) : (
        <span className="text-[13px] text-text-muted">
          {filtersActive || onHandTotal === undefined
            ? t("detail.stock.positions", { count: total, value: text.number(total) })
            : t("detail.stock.summary", {
                positions: t("detail.stock.positions", { count: total, value: text.number(total) }),
                pcs: text.pcs(onHandTotal),
              })}
        </span>
      )
    ) : null;

  return (
    <>
      <div role="group" aria-label={t("detail.stock.filtersLabel")} className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
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
          placeholder={t("detail.stock.searchPlaceholder")}
          aria-label={t("detail.stock.searchLabel")}
          className="min-w-0 flex-[6_1_280px]"
        />
        <Field label={t("detail.stock.marketFilter")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_200px] max-md:basis-full">
          <Select
            options={marketOptions}
            value={filters.marketId || null}
            onChange={(next) => applyFilters({ marketId: next ?? "" })}
            searchable={marketOptions.length > 8}
            placeholder={t("list.all")}
            inlineLabel={t("detail.stock.marketFilter")}
          />
        </Field>
        <Field label={t("detail.stock.levelFilter")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_180px] max-md:basis-full">
          <Select
            options={levelOptions}
            value={filters.level || null}
            onChange={(next) => applyFilters({ level: (next ?? "") as StockFilters["level"] })}
            placeholder={t("list.all")}
            inlineLabel={t("detail.stock.levelFilter")}
          />
        </Field>
      </div>
      <QueryBoundary
        query={{ ...query, data: data?.items }}
        loadingLabel={t("detail.stock.loading")}
        loading={
          <SkeletonTable
            framed={false}
            columns={[t("detail.stock.columns.product"), t("detail.stock.columns.onHand"), t("detail.stock.columns.available")]}
            rows={5}
          />
        }
        empty={
          filtersActive ? (
            <EmptyState
              icon={SearchX}
              title={t("detail.stock.notFoundTitle")}
              description={t("detail.stock.notFoundDescription")}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {t("list.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Tag}
              title={t("detail.stock.emptyTitle")}
              description={t(canManage ? "detail.stock.emptyDescription" : "detail.stock.emptyDescriptionManager")}
              action={
                canManage ? (
                  <Button leftIcon={PackagePlus} aria-haspopup="dialog" disabled={addStockDisabled} onClick={onAddStock}>
                    {t("stockIn.open")}
                  </Button>
                ) : undefined
              }
            />
          )
        }
        error={(error, retry) => <ErrorState error={error} title={t("detail.stock.loadFailed")} onRetry={retry} />}
      >
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.stockId}
            label={t("detail.stock.tableLabel")}
            cardsLabel={t("detail.stock.tableLabel")}
            renderCard={renderCard}
            busy={isFetching && isPlaceholderData}
            density="tablet-tight"
            className="border-t border-border"
          />
        )}
      </QueryBoundary>
      {footer ? <div className={PANEL_FOOT}>{footer}</div> : null}
    </>
  );
};
