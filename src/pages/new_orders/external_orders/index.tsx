import { memo, useMemo, useState } from "react";
import { AlertCircle, CalendarRange, Cable, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import Pagination from "../../../shared/components/pagination";
import {
  getIntegrationErrorMessage,
  type Integration,
  type IntegrationParams,
  useGetIntegrations,
} from "../../../entities/integrations";

const DEFAULT_LIMIT = 10;

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

const ExternalOrdersPage = () => {
  const { t } = useTranslation(["newOrders", "common"]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || DEFAULT_LIMIT));

  const params = useMemo<IntegrationParams>(() => {
    const nextParams: IntegrationParams = { page, limit };
    if (status) nextParams.status = status;
    if (search.trim()) nextParams.market_id = search.trim();
    if (dateFrom) nextParams.from_date = dateFrom;
    if (dateTo) nextParams.to_date = dateTo;
    return nextParams;
  }, [dateFrom, dateTo, limit, page, search, status]);

  const query = useGetIntegrations(params);
  const items = query.data?.data?.items ?? [];
  const meta = query.data?.data?.meta;
  const currentPage = meta?.page ?? page;
  const currentLimit = meta?.limit ?? limit;
  const total = meta?.total ?? items.length;

  const updatePage = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(Math.max(1, nextPage)));
    nextParams.set("limit", String(currentLimit));
    setSearchParams(nextParams, { replace: true });
  };

  const updateLimit = (nextLimit: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "1");
    nextParams.set("limit", String(Math.max(1, nextLimit)));
    setSearchParams(nextParams, { replace: true });
  };

  const columns = useMemo<ColumnConfig<Integration>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "64px",
        render: (_value, _row, index) => (
          <span className="text-xs font-semibold text-maindark/50 dark:text-primary/50">
            {(currentPage - 1) * currentLimit + index + 1}
          </span>
        ),
      },
      {
        key: "name",
        label: t("integration"),
        render: (value, row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
              {value}
            </p>
            <p className="mt-0.5 truncate text-xs text-maindark/45 dark:text-primary/45">
              {t("idLabel", { id: row.id })}
            </p>
          </div>
        ),
      },
      {
        key: "api_url",
        label: t("apiUrl"),
        render: (value) => <span className="text-sm text-maindark dark:text-primary">{value || "-"}</span>,
      },
      {
        key: "auth_type",
        label: t("auth"),
        render: (value, row) => (
          <div className="min-w-0">
            <p className="text-sm font-medium text-maindark dark:text-primary">{value || "-"}</p>
            <p className="mt-0.5 truncate text-xs text-maindark/45 dark:text-primary/45">
              {row.username || row.slug || "-"}
            </p>
          </div>
        ),
      },
      {
        key: "last_sync_at",
        label: t("lastSync"),
        render: (value) => <span className="text-sm text-maindark dark:text-primary">{formatDateTime(value)}</span>,
      },
      {
        key: "status",
        label: t("status"),
        render: (_value, row) => (
          <span
            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
              row.is_active
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            {row.is_active ? t("active") : t("inactive")}
          </span>
        ),
      },
    ],
    [currentLimit, currentPage, t],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("all") },
      { value: "active", label: t("active") },
      { value: "inactive", label: t("inactive") },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-glass-border bg-white/95 p-4 shadow-sm dark:bg-primarydark sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-maindark dark:text-primary">
              {t("integrationsTitle")}
            </h2>
            <p className="mt-1 text-sm text-maindark/45 dark:text-primary/45">
              {t("integrationsSubtitle")}
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

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70 xl:flex-[1.35]">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <Search size={12} className="text-main/70" />
              {t("search", { ns: "common" })}
            </div>
            <FilterSearch
              value={search}
              onChange={(value) => {
                setSearch(value);
                updatePage(1);
              }}
              placeholder={t("searchIntegration")}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70 xl:w-72">
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
                updatePage(1);
              }}
              options={statusOptions}
              placeholder={t("all")}
              size="sm"
              hideLabel
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70 xl:flex-1">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <CalendarRange size={12} className="text-main/70" />
              {t("dateRange")}
            </div>
            <FilterDateRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeDateFrom={(value) => {
                setDateFrom(value);
                updatePage(1);
              }}
              onChangeDateTo={(value) => {
                setDateTo(value);
                updatePage(1);
              }}
              className="w-full"
              fromClassName="w-full sm:w-full lg:w-48"
              toClassName="w-full sm:w-full lg:w-48"
              size="sm"
            />
          </div>
        </div>
      </div>

      {query.isError && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <AlertCircle size={16} />
          <span>{getIntegrationErrorMessage(query.error) || t("integrationsLoadError")}</span>
        </div>
      )}

      {items.length === 0 && !query.isLoading ? (
        <div className="rounded-2xl border border-glass-border bg-white p-10 text-center dark:bg-primarydark">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-main/10 text-main">
            <Cable size={24} />
          </div>
          <p className="mt-4 text-sm font-semibold text-maindark dark:text-primary">
            {t("integrationsNotFound")}
          </p>
        </div>
      ) : (
        <Table
          data={items}
          columns={columns}
          loading={query.isLoading}
          keyExtractor={(row) => row.id}
          emptyMessage={t("integrationsNotFound")}
          onRowClick={(row) => navigate(`/new-orders/integrations/${row.id}`)}
        />
      )}

      {!query.isLoading && (
        <div className="rounded-2xl border border-glass-border bg-white px-4 py-4 dark:bg-primarydark">
          <Pagination
            totalItems={total}
            itemsPerPage={currentLimit}
            currentPage={currentPage}
            onPageChange={updatePage}
            onItemsPerPageChange={updateLimit}
            className="pt-0"
          />
        </div>
      )}
    </div>
  );
};

export default memo(ExternalOrdersPage);
