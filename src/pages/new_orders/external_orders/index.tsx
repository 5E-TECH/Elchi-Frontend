import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronLeft, ChevronRight, Globe, RefreshCw, X } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import {
  getIntegrationErrorMessage,
  useGetIntegrations,
  type Integration,
  type IntegrationParams,
} from "../../../entities/integrations";

const fmtDateTime = (raw?: string | null) => {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`;
};

const External_orders = () => {
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [isActive, setIsActive] = useState("");
  const [status, setStatus] = useState("");
  const [marketId, setMarketId] = useState("");
  const [search, setSearch] = useState("");

  const hasFilters = !!(isActive || status || marketId || dateFrom || dateTo || search);

  const params = useMemo((): IntegrationParams => {
    const p: IntegrationParams = { page, limit };
    if (isActive) p.is_active = isActive;
    if (status) p.status = status;
    if (marketId.trim()) p.market_id = marketId.trim();
    if (dateFrom) p.from_date = dateFrom;
    if (dateTo) p.to_date = dateTo;
    return p;
  }, [dateFrom, dateTo, isActive, limit, marketId, page, status]);

  const query = useGetIntegrations(params);
  const items = query.data?.data?.items ?? [];
  const meta = query.data?.data?.meta ?? null;

  const activePage = meta?.page ?? page;
  const pageLimit = meta?.limit ?? limit;
  const totalPages = meta?.totalPages ?? 1;
  const rowOffset = (activePage - 1) * pageLimit;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.name ?? ""} ${it.slug ?? ""} ${it.api_url ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const columns = useMemo<ColumnConfig<Integration>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "56px",
        render: (_v, _row, index) => (
          <span className="text-xs font-mono text-gray-400 dark:text-white/30 select-none">
            {String(rowOffset + index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        key: "name",
        label: "Integratsiya",
        render: (_v, row) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-main/8 dark:bg-main/15 flex items-center justify-center shrink-0 ring-1 ring-main/10">
              <Globe size={13} className="text-main" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white truncate m-0 leading-tight">
                {row.name || "—"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-white/35 truncate m-0 mt-0.5">
                {row.slug ? `/${row.slug}` : "—"}{" "}
                {row.market_id ? `· market_id: ${row.market_id}` : ""}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "api_url",
        label: "API URL",
        className: "hidden lg:table-cell",
        render: (value) => (
          <span className="text-xs font-mono text-gray-600 dark:text-white/55 truncate block max-w-105">
            {String(value ?? "—")}
          </span>
        ),
      },
      {
        key: "auth_type",
        label: "Auth",
        width: "140px",
        className: "hidden md:table-cell",
        render: (value) => (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-main-soft text-main">
            {String(value ?? "—")}
          </span>
        ),
      },
      {
        key: "is_active",
        label: "Faol",
        width: "120px",
        render: (value) => {
          const active = Boolean(value);
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                active
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-error/10 text-error border border-error/20"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-success" : "bg-error"}`} />
              {active ? "Faol" : "Nofaol"}
            </span>
          );
        },
      },
      {
        key: "total_synced_orders",
        label: "Synced",
        width: "120px",
        sortable: true,
        render: (value) => (
          <span className="text-sm font-bold tabular-nums text-gray-800 dark:text-white/80">
            {Number(value ?? 0).toLocaleString("uz-UZ")}
          </span>
        ),
      },
      {
        key: "last_sync_at",
        label: "Oxirgi sync",
        width: "170px",
        className: "hidden xl:table-cell",
        render: (value) => (
          <span className="text-xs text-gray-500 dark:text-white/50 tabular-nums">
            {fmtDateTime(String(value ?? ""))}
          </span>
        ),
      },
    ],
    [rowOffset],
  );

  const isActiveOptions = useMemo(
    () => [
      { value: "", label: "Barchasi" },
      { value: "true", label: "Faol" },
      { value: "false", label: "Nofaol" },
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Barchasi" },
      { value: "active", label: "active" },
      { value: "inactive", label: "inactive" },
    ],
    [],
  );

  const canPrev = activePage > 1;
  const canNext = activePage < totalPages;

  const errorMessage = query.isError
    ? getIntegrationErrorMessage(query.error) || "Integratsiyalarni yuklashda xatolik yuz berdi"
    : "";

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - activePage) <= 1,
  );

  const handleResetFilters = () => {
    setIsActive("");
    setStatus("");
    setMarketId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-primarydark border border-glass-border rounded-2xl shadow-sm shadow-main-soft dark:shadow-none">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-main/10 dark:bg-main/20 ring-1 ring-main/15">
              <Globe size={17} className="text-main" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white m-0">
                  Integratsiyalar
                </h2>
                {query.isFetching && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-main/10 dark:bg-main/20 text-main font-bold animate-pulse tracking-wide">
                    yangilanmoqda
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-white/40 m-0 mt-0.5">
                QR kod orqali tashqi buyurtmalarni qidirish uchun integratsiyani tanlang
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FilterSearch
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder="Integratsiya qidirish..."
              debounceDelay={350}
              className="w-56"
            />

            <button
              type="button"
              onClick={() => query.refetch()}
              title="Yangilash"
              className="h-9 w-9 rounded-xl flex items-center justify-center bg-main-soft/30 dark:bg-white/5 border border-glass-border hover:border-main/40 hover:text-main dark:hover:border-main/40 text-gray-500 dark:text-white/40 transition-all"
            >
              <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
            </button>

            {hasFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-main-soft/30 dark:bg-white/5 border border-glass-border text-gray-500 dark:text-white/50 hover:border-error/40 hover:text-error dark:hover:border-error/40 transition-all"
              >
                <X size={12} />
                Tozalash
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-white/6 mx-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 px-4 py-3">
          <FilterSelect
            name="is_active"
            label="Faollik"
            value={isActive}
            onChange={(v) => { setIsActive(v); setPage(1); }}
            options={isActiveOptions}
            placeholder="Barchasi"
            size="sm"
          />

          <FilterSelect
            name="status"
            label="Status"
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={statusOptions}
            placeholder="Barchasi"
            size="sm"
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="market_id"
              className="text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider"
            >
              Market ID
            </label>
            <input
              id="market_id"
              value={marketId}
              onChange={(e) => { setMarketId(e.target.value); setPage(1); }}
              placeholder="masalan: 1"
              className="h-9 rounded-lg px-3 bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 text-[13px] font-medium text-maindark dark:text-primary placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all"
            />
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-white/35 uppercase tracking-widest mb-1.5">
              Sana oralig'i
            </div>
            <FilterDateRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeDateFrom={(v) => { setDateFrom(v); setPage(1); }}
              onChangeDateTo={(v) => { setDateTo(v); setPage(1); }}
              size="sm"
              className="flex-wrap sm:flex-nowrap"
              fromClassName="w-full sm:w-36"
              toClassName="w-full sm:w-36"
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-xl border border-error/20 bg-error/6 dark:bg-error/10 text-error text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-white/5 border border-error/20 hover:bg-error/10 transition-colors text-xs font-bold"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {query.isFetching && filteredItems.length === 0 ? (
          Array.from({ length: 6 }, (_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="rounded-2xl border border-glass-border bg-white dark:bg-primarydark p-4">
              <div className="h-4 w-44 bg-main-soft rounded-md animate-pulse" />
              <div className="h-3 w-64 bg-main-soft rounded-md animate-pulse mt-2" />
              <div className="flex items-center gap-2 mt-3">
                <div className="h-6 w-16 bg-main-soft rounded-lg animate-pulse" />
                <div className="h-6 w-20 bg-main-soft rounded-lg animate-pulse" />
              </div>
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-glass-border bg-white dark:bg-primarydark p-6 text-center text-sm text-gray-500 dark:text-white/50">
            Integratsiyalar topilmadi
          </div>
        ) : (
          filteredItems.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => navigate(`/new-orders/external/${row.id}`)}
              className="w-full text-left rounded-2xl border border-glass-border bg-white dark:bg-primarydark p-4 hover:border-main/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-main/10 dark:bg-main/20 ring-1 ring-main/15 flex items-center justify-center shrink-0">
                  <Globe size={16} className="text-main" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-extrabold text-gray-900 dark:text-white truncate">
                    {row.name || "—"}
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-gray-400 dark:text-white/40 truncate">
                    {row.api_url || "—"}
                  </p>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        row.is_active
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-error/10 text-error border border-error/20"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${row.is_active ? "bg-success" : "bg-error"}`} />
                      {row.is_active ? "Ulangan" : "Ulanmagan"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-main-soft text-main">
                      Synced: {Number(row.total_synced_orders ?? 0).toLocaleString("uz-UZ")}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table<Integration>
          data={filteredItems}
          columns={columns}
          loading={query.isFetching && filteredItems.length === 0}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/new-orders/external/${row.id}`)}
          hoverable
          emptyMessage="Integratsiyalar topilmadi"
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-1">
          <span className="text-xs text-gray-400 dark:text-white/30 tabular-nums">
            {activePage}-sahifa / {totalPages}
            {meta?.total !== undefined && (
              <span className="ml-1 text-gray-300 dark:text-white/20">
                ({meta.total} ta)
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => canPrev && setPage((p) => p - 1)}
              disabled={!canPrev}
              className="h-8 w-8 rounded-lg flex items-center justify-center border border-glass-border text-gray-500 dark:text-white/40 hover:border-main/40 hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={14} />
            </button>

            {pageNumbers
              .reduce<(number | "…")[]>((acc, p, idx) => {
                const prev = pageNumbers[idx - 1];
                if (prev !== undefined && p - prev > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-8 h-8 flex items-center justify-center text-xs text-gray-400 dark:text-white/25"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    className={`h-8 min-w-8 px-2.5 rounded-lg text-xs font-bold transition-all ${
                      p === activePage
                        ? "bg-main text-white shadow-sm shadow-main/25"
                        : "border border-glass-border text-gray-500 dark:text-white/40 hover:border-main/40 hover:text-main"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

            <button
              type="button"
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext}
              className="h-8 w-8 rounded-lg flex items-center justify-center border border-glass-border text-gray-500 dark:text-white/40 hover:border-main/40 hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(External_orders);
