import { memo, useMemo, useState } from "react";
import { Activity, Globe } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterSelect from "../../../shared/ui/FilterSelect";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import {
  useGetIntegrations,
  type Integration,
  type IntegrationParams,
} from "../../../entities/integrations";

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

const formatDate = (raw?: string | null): string => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Holat badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${isActive
      ? "bg-success/10 text-success"
      : "bg-error/10 text-error"
      }`}
  >
    <span
      className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-success" : "bg-error"
        }`}
    />
    {isActive ? "Faol" : "Nofaol"}
  </span>
);

// ─── Asosiy komponent ─────────────────────────────────────────────────────────

const ExternalOrders = () => {
  const [isActive, setIsActive] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Filter o'zgarganda paginationni reset qilish
  const handleIsActiveChange = (val: string) => {
    setIsActive(val);
    setPage(1);
  };
  const handleDateFromChange = (val: string) => {
    setDateFrom(val);
    setPage(1);
  };
  const handleDateToChange = (val: string) => {
    setDateTo(val);
    setPage(1);
  };

  // API params
  const params = useMemo<IntegrationParams>(() => {
    const p: IntegrationParams = { page, limit };
    if (isActive) p.is_active = isActive;
    if (dateFrom) p.from_date = dateFrom;
    if (dateTo) p.to_date = dateTo;
    return p;
  }, [page, limit, isActive, dateFrom, dateTo]);

  const { data, isLoading } = useGetIntegrations(params);

  // API dan kelgan ma'lumotni xavfsiz qabul qilish
  const integrations: Integration[] = useMemo(() => {
    const raw = data as any;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;
    return [];
  }, [data]);

  // Pagination: server paginatsiya yo'q bo'lsa — client side
  const totalPages = Math.max(1, Math.ceil(integrations.length / limit));
  const rowOffset = (page - 1) * limit;
  const pagedData = useMemo(
    () => integrations.slice(rowOffset, rowOffset + limit),
    [integrations, rowOffset, limit]
  );
  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Jadval ustunlari
  const columns = useMemo<ColumnConfig<Integration>[]>(
    () => [
      {
        key: "id",
        label: "Raqam",
        width: "60px",
        render: (_v, _row, i) => (
          <span className="text-gray-400 dark:text-white/40 font-semibold text-xs">
            {rowOffset + i + 1}
          </span>
        ),
      },
      {
        key: "name",
        label: "Do'kon",
        sortable: true,
        render: (_v, row) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-main/10 dark:bg-main/20 flex items-center justify-center shrink-0">
              <Globe size={14} className="text-main" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {row.name}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-white/40 truncate">
                {row.slug}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "total_synced_orders",
        label: "Mahsulotlar",
        sortable: true,
        render: (v) => (
          <span className="font-bold text-main tabular-nums">
            {Number(v ?? 0).toLocaleString("uz-UZ")}
          </span>
        ),
      },
      {
        key: "id" as any, // Summa API da yo'q, shuning uchun dummy key
        label: "Summa",
        render: () => (
          <span className="text-gray-400 dark:text-white/40">—</span>
        ),
      },
      {
        key: "is_active",
        label: "Holat",
        render: (v) => <StatusBadge isActive={Boolean(v)} />,
      },
      {
        key: "createdAt",
        label: "Sana",
        render: (v) => (
          <span className="text-xs text-gray-500 dark:text-white/50 whitespace-nowrap">
            {formatDate(v as string)}
          </span>
        ),
      },
    ],
    [rowOffset]
  );

  const isActiveOptions = useMemo(
    () => [
      { value: "", label: "Barchasi" },
      { value: "true", label: "Faol" },
      { value: "false", label: "Nofaol" },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Filterlar */}
      <div className="bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* is_active filtri */}
          <div className="w-full md:w-48">
            <FilterSelect
              name="integration_is_active"
              label="Holat"
              value={isActive}
              onChange={handleIsActiveChange}
              options={isActiveOptions}
              icon={Activity}
              placeholder="Barchasi"
            />
          </div>

          {/* Sana filtri */}
          <div className="w-full md:w-auto md:ml-auto">
            <div className="text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider mb-1.5">
              Sana oralig'i
            </div>
            <FilterDateRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeDateFrom={handleDateFromChange}
              onChangeDateTo={handleDateToChange}
              className="flex-wrap md:flex-nowrap"
            />
          </div>
        </div>
      </div>

      {/* Jadval */}
      <Table<Integration>
        data={pagedData}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        hoverable
        emptyMessage="Tashqi buyurtmalar yo'q"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-white/40">
            {page}-sahifa / {totalPages}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canPrev && setPage((p) => p - 1)}
              disabled={!canPrev}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Oldingi
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`min-w-10 h-10 px-3 rounded-xl text-xs font-bold transition-colors ${p === page
                    ? "bg-main text-white shadow-sm shadow-main/30"
                    : "border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-main/10 hover:text-main"
                    }`}
                >
                  {p}
                </button>
              ))}

            <button
              type="button"
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Keyingi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ExternalOrders);
