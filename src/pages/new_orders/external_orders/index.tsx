import { memo, useMemo, useState } from "react";
import { AlertCircle, CalendarRange, Package, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import { useOrders } from "../../../entities/order/api/orderApi";
import type {
  ExternalOrderItem,
  ExternalOrdersParams,
} from "../../../entities/order/types/order";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatAmount = (value?: number | null) =>
  Number(value ?? 0).toLocaleString("uz-UZ");

const getOrderNumber = (order: ExternalOrderItem) =>
  order.order_number || order.external_id || order.id;

const getStoreName = (order: ExternalOrderItem) =>
  order.store_name ||
  order.shop_name ||
  order.integration_name ||
  order.marketplace_name ||
  "-";

const getProductsLabel = (order: ExternalOrderItem) => {
  const itemNames = (order.items ?? [])
    .map((item) => item.name || item.product_name)
    .filter(Boolean);

  if (itemNames.length > 0) {
    return itemNames.slice(0, 2).join(", ");
  }

  return "-";
};

const getProductsCount = (order: ExternalOrderItem) =>
  order.products_count ?? order.items_count ?? order.items?.length ?? 0;

const ExternalOrdersPage = () => {
  const { t } = useTranslation(["newOrders", "common"]);
  const { getExternalOrders } = useOrders();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = useMemo<ExternalOrdersParams>(() => {
    const nextParams: ExternalOrdersParams = { page, limit };
    if (status) nextParams.status = status;
    if (search.trim()) nextParams.search = search.trim();
    if (dateFrom) nextParams.from_date = dateFrom;
    if (dateTo) nextParams.to_date = dateTo;

    return nextParams;
  }, [dateFrom, dateTo, limit, page, search, status]);

  const query = getExternalOrders(params);
  const items = query.data?.data?.items ?? [];
  const meta = query.data?.data?.meta ?? query.data?.data?.pagination;

  const columns = useMemo<ColumnConfig<ExternalOrderItem>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "64px",
        render: (_value, _row, index) => (
          <span className="text-xs font-semibold text-maindark/50 dark:text-primary/50">
            {(meta?.page ? (meta.page - 1) * (meta.limit ?? limit) : (page - 1) * limit) + index + 1}
          </span>
        ),
      },
      {
        key: "order_number",
        label: t("externalColumns.number"),
        render: (_value, row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
              {getOrderNumber(row)}
            </p>
            <p className="mt-0.5 truncate text-xs text-maindark/45 dark:text-primary/45">
              {formatDateTime(row.createdAt || row.created_at || row.updatedAt)}
            </p>
          </div>
        ),
      },
      {
        key: "store_name",
        label: t("externalColumns.store"),
        render: (_value, row) => (
          <span className="text-sm font-medium text-maindark dark:text-primary">
            {getStoreName(row)}
          </span>
        ),
      },
      {
        key: "items",
        label: t("externalColumns.products"),
        render: (_value, row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-maindark dark:text-primary">
              {getProductsLabel(row)}
            </p>
            <p className="mt-0.5 text-xs text-maindark/45 dark:text-primary/45">
              {t("productsCount", { count: getProductsCount(row) })}
            </p>
          </div>
        ),
      },
      {
        key: "total_price",
        label: t("externalColumns.amount"),
        render: (_value, row) => (
          <span className="whitespace-nowrap text-sm font-bold text-main">
            {formatAmount(row.total_price ?? row.amount)} {t("total")}
          </span>
        ),
      },
      {
        key: "status",
        label: t("externalColumns.status"),
        render: (value) => (
          <span className="inline-flex rounded-lg bg-main/10 px-2.5 py-1 text-xs font-semibold text-main">
            {value || "-"}
          </span>
        ),
      },
    ],
    [limit, meta?.limit, meta?.page, page, t],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("all") },
      { value: "new", label: t("statusNew") },
      { value: "processing", label: t("statusProcessing") },
      { value: "completed", label: t("statusCompleted") },
    ],
    [t],
  );

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-glass-border bg-white/95 p-4 shadow-sm dark:bg-primarydark sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-maindark dark:text-primary">
              {t("externalOrdersTitle")}
            </h2>
            <p className="mt-1 text-sm text-maindark/45 dark:text-primary/45">
              {t("externalOrdersSubtitle")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => query.refetch()}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-2xl border border-glass-border bg-sidebar/50 text-maindark/60 transition-all hover:border-main/30 hover:text-main dark:bg-maindark/40 dark:text-primary/60 sm:self-auto"
            aria-label={t("refresh", { ns: "common" })}
          >
            <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(14rem,0.7fr)]">
          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <Search size={12} className="text-main/70" />
              {t("search", { ns: "common" })}
            </div>
            <FilterSearch
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder={t("searchOrder")}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <SlidersHorizontal size={12} className="text-main/70" />
              {t("status")}
            </div>
            <FilterSelect
              name="status"
              label={t("status")}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={statusOptions}
              placeholder={t("all")}
              size="sm"
              hideLabel
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
            <CalendarRange size={12} className="text-main/70" />
            {t("dateRange")}
          </div>
          <FilterDateRange
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChangeDateFrom={(value) => {
              setDateFrom(value);
              setPage(1);
            }}
            onChangeDateTo={(value) => {
              setDateTo(value);
              setPage(1);
            }}
            className="w-full"
            fromClassName="w-full sm:w-full lg:w-48"
            toClassName="w-full sm:w-full lg:w-48"
            size="sm"
          />
        </div>
      </div>

      {query.isError && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <AlertCircle size={16} />
          <span>{t("externalOrdersLoadError")}</span>
        </div>
      )}

      {items.length === 0 && !query.isLoading ? (
        <div className="rounded-2xl border border-glass-border bg-white p-10 text-center dark:bg-primarydark">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-main/10 text-main">
            <Package size={24} />
          </div>
          <p className="mt-4 text-sm font-semibold text-maindark dark:text-primary">
            {t("externalOrdersEmpty")}
          </p>
        </div>
      ) : (
        <Table
          data={items}
          columns={columns}
          loading={query.isLoading}
          keyExtractor={(row) => row.id}
          emptyMessage={t("externalOrdersEmpty")}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-maindark/45 dark:text-primary/45">
            {t("pageOf", { page: meta?.page ?? page, totalPages })}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={(meta?.page ?? page) <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-glass-border px-3 py-1.5 text-xs font-semibold text-maindark transition-colors hover:border-main/30 hover:text-main disabled:opacity-40 dark:text-primary"
            >
              {t("common:previous")}
            </button>
            <button
              type="button"
              disabled={(meta?.page ?? page) >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-lg border border-glass-border px-3 py-1.5 text-xs font-semibold text-maindark transition-colors hover:border-main/30 hover:text-main disabled:opacity-40 dark:text-primary"
            >
              {t("common:next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ExternalOrdersPage);
