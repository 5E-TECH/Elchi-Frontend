import { memo, useMemo, useState } from "react";
import { Globe, QrCode, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import type { AxiosError } from "axios";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterSelect from "../../../shared/ui/FilterSelect";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import { api } from "../../../shared/api/api";
import { GlobalSearchInput } from "../../../features/search";

type ExternalOrderStatus =
  | "new"
  | "processing"
  | "completed"
  | "cancelled"
  | string;

type ExternalOrderItem = {
  id?: string;
  quantity?: number;
  product?: { name?: string | null };
};

type ExternalOrder = {
  id: string;
  status?: ExternalOrderStatus;
  total_price?: number;
  createdAt?: string;
  created_at?: string;
  market?: { name?: string | null };
  shop?: { name?: string | null };
  items?: ExternalOrderItem[];
};

type Pagination = {
  page: number;
  limit: number;
  total?: number;
  totalPages: number;
};

interface ExternalOrdersSearchValues {
  search: string;
}

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const statusLabel = (s?: string) => {
  if (!s) return "—";
  if (s === "new") return "Yangi";
  if (s === "processing") return "Jarayonda";
  if (s === "completed") return "Tayyor";
  if (s === "cancelled") return "Bekor qilingan";
  return s;
};

const statusClass = (s?: string) => {
  if (s === "new") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (s === "processing") return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (s === "completed") return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (s === "cancelled") return "bg-rose-500/10 text-rose-400";
  return "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/60";
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const getPagination = (response: unknown): Pagination | null => {
  if (!isRecord(response)) return null;

  const data = isRecord(response.data) ? response.data : undefined;
  const meta =
    (data && (isRecord(data.pagination) ? data.pagination : undefined)) ??
    (data && (isRecord(data.meta) ? data.meta : undefined)) ??
    (isRecord(response.pagination) ? response.pagination : undefined) ??
    (isRecord(response.meta) ? response.meta : undefined);

  if (!meta) return null;

  const page = Number((meta.page as number | string | undefined) ?? 1);
  const limit = Number((meta.limit as number | string | undefined) ?? 10);
  const totalPages = Number(
    (meta.totalPages as number | string | undefined) ??
      (meta.total_pages as number | string | undefined) ??
      1,
  );
  const totalVal = meta.total as number | string | undefined;
  const total = totalVal !== undefined ? Number(totalVal) : undefined;

  return { page, limit, totalPages, total };
};

const getItems = (response: unknown): ExternalOrder[] => {
  if (!isRecord(response)) return [];
  const data = isRecord(response.data) ? response.data : undefined;

  const items =
    (data && Array.isArray(data.items) ? data.items : undefined) ??
    (data && Array.isArray(data.data) ? data.data : undefined) ??
    (data && Array.isArray(data) ? data : undefined) ??
    (Array.isArray(response.items) ? response.items : undefined) ??
    [];

  return items as ExternalOrder[];
};

const getApiMessage = (err: unknown): string => {
  const axiosErr = err as AxiosError<{ message?: unknown }>;
  const msg = axiosErr?.response?.data?.message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map(String).join(", ");
  return "";
};

const isNumericIdError = (err: unknown): boolean => {
  const msg = getApiMessage(err);
  return msg.includes("ID qiymatlari") && msg.includes("raqam");
};

const fetchExternalOrders = async (
  params: Record<string, string | number>,
): Promise<unknown> => {
  const endpoints = [
    "orders/external",
    "orders/external-orders",
    "orders/external_orders",
  ] as const;

  try {
    const res = await api.get(endpoints[0], { params });
    return res.data as unknown;
  } catch (err) {
    if (!isNumericIdError(err)) throw err;

    for (const ep of endpoints.slice(1)) {
      try {
        const res = await api.get(ep, { params });
        return res.data as unknown;
      } catch {
        // next
      }
    }

    throw err;
  }
};

const ExternalOrders = () => {
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { control, watch, setValue } = useForm<ExternalOrdersSearchValues>({
    defaultValues: { search: "" },
  });

  const search = watch("search");

  const handleStatusChange = (val: string) => {
    setStatus(val);
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

  const handleResetFilters = () => {
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setValue("search", "");
    setPage(1);
  };

  const params = useMemo(() => {
    const nextParams: Record<string, string | number> = { page, limit };

    if (status) nextParams.status = status;
    if (dateFrom) nextParams.start_day = dateFrom;
    if (dateTo) nextParams.end_day = dateTo;
    if (search.trim()) nextParams.search = search.trim();

    return nextParams;
  }, [dateFrom, dateTo, limit, page, search, status]);

  const query = useQuery({
    queryKey: ["orders", "external", params],
    queryFn: () => fetchExternalOrders(params),
  });

  const orders = useMemo(() => getItems(query.data), [query.data]);
  const pagination = useMemo(() => getPagination(query.data), [query.data]);
  const activePage = pagination?.page ?? page;
  const totalPages = pagination?.totalPages ?? 1;
  const rowOffset = (activePage - 1) * (pagination?.limit ?? limit);

  const columns = useMemo<ColumnConfig<ExternalOrder>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "70px",
        render: (_v, _row, rowIndex) => (
          <span className="text-gray-400 dark:text-gray-500 font-semibold">
            {rowOffset + rowIndex + 1}
          </span>
        ),
      },
      {
        key: "market",
        label: "Do'kon",
        sortable: true,
        render: (_v, row) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-main/10 dark:bg-main/20 flex items-center justify-center shrink-0">
              <QrCode size={14} className="text-main" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white truncate">
              {row.market?.name ?? row.shop?.name ?? "—"}
            </span>
          </div>
        ),
      },
      {
        key: "items",
        label: "Mahsulotlar",
        render: (_v, row) => {
          const list = row.items ?? [];

          if (list.length === 0) {
            return <span className="text-gray-400 dark:text-white/40">—</span>;
          }

          const text = list
            .slice(0, 3)
            .map((item) => {
              const name = item.product?.name ?? "—";
              const qty = item.quantity ?? 0;
              return `${name}×${qty}`;
            })
            .join(", ");
          const more = list.length > 3 ? ` +${list.length - 3}` : "";

          return (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {text}
              {more}
            </span>
          );
        },
      },
      {
        key: "total_price",
        label: "Summa",
        sortable: true,
        render: (value) => (
          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {fmt(Number(value ?? 0))} so'm
          </span>
        ),
      },
      {
        key: "status",
        label: "Holat",
        render: (value) => (
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusClass(
              String(value ?? ""),
            )}`}
          >
            {statusLabel(String(value ?? ""))}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Sana",
        render: (value, row) => {
          const raw = (value ?? row.created_at ?? "") as string;
          const date = raw ? new Date(raw) : null;
          const text =
            date && !Number.isNaN(date.getTime())
              ? date.toLocaleString("uz-UZ", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : raw || "—";

          return (
            <span className="text-xs text-gray-500 dark:text-white/50 whitespace-nowrap">
              {text}
            </span>
          );
        },
      },
    ],
    [rowOffset],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Barcha holat" },
      { value: "new", label: "Yangi" },
      { value: "processing", label: "Jarayonda" },
      { value: "completed", label: "Tayyor" },
      { value: "cancelled", label: "Bekor qilingan" },
    ],
    [],
  );

  const canPrev = activePage > 1;
  const canNext = activePage < totalPages;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500">
              <Globe size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-white m-0">
                Tashqi buyurtmalar
              </p>
              <p className="text-xs text-gray-500 dark:text-white/50 m-0">
                Filtrlar: qidiruv, holat va sana oralig'i
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Controller
              control={control}
              name="search"
              render={({ field }) => (
                <GlobalSearchInput
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  placeholder="Market qidirish..."
                  className="w-64"
                  inputClassName="bg-white dark:bg-primarydark border-gray-200 dark:border-white/10 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 py-2.5 shadow-none focus:shadow-none"
                  iconClassName="text-gray-400 dark:text-gray-500 group-focus-within:text-main"
                  clearButtonClassName="text-gray-400 dark:text-gray-500 hover:text-main"
                  onValueChange={(value) => {
                    field.onChange(value);
                    setPage(1);
                  }}
                />
              )}
            />

            <button
              type="button"
              onClick={() => query.refetch()}
              className="p-2.5 rounded-xl bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-primarydark/80 transition-colors"
              aria-label="Yangilash"
            >
              <RefreshCw
                size={18}
                className={query.isFetching ? "animate-spin text-gray-400" : "text-gray-400"}
              />
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2.5 rounded-xl bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-primarydark/80 transition-colors text-sm font-medium text-gray-600 dark:text-white/70"
            >
              Tozalash
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <FilterSelect
            name="external_status"
            label="Holat"
            value={status}
            onChange={handleStatusChange}
            options={statusOptions}
            placeholder="Holatni tanlang"
          />

          <div className="md:col-span-2">
            <div className="text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              Sana
            </div>
            <FilterDateRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeDateFrom={handleDateFromChange}
              onChangeDateTo={handleDateToChange}
              className="flex-wrap"
            />
          </div>
        </div>
      </div>

      <Table<ExternalOrder>
        data={orders}
        columns={columns}
        loading={query.isLoading}
        keyExtractor={(row) => row.id}
        hoverable
        emptyMessage="Tashqi buyurtmalar yo'q"
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-white/40">
            {activePage}-sahifa / {totalPages}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canPrev && setPage(activePage - 1)}
              disabled={!canPrev}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Oldingi
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((currentPage) => Math.abs(currentPage - activePage) <= 2)
              .map((currentPage) => (
                <button
                  key={currentPage}
                  type="button"
                  onClick={() => setPage(currentPage)}
                  className={`min-w-10 h-10 px-3 rounded-xl text-xs font-bold transition-colors ${
                    currentPage === activePage
                      ? "bg-main text-white shadow-sm shadow-main/30"
                      : "border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-main/10 hover:text-main"
                  }`}
                >
                  {currentPage}
                </button>
              ))}

            <button
              type="button"
              onClick={() => canNext && setPage(activePage + 1)}
              disabled={!canNext}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
