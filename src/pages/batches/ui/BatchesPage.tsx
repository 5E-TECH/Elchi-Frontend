import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, PackageSearch } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import { Table } from "../../../shared/components/Table/Table";
import FilterSelect from "../../../shared/ui/FilterSelect";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useBatches, type Batch, type BatchDatePreset, type BatchDirection, type BatchStatus } from "../../../entities/batch";
import {
  batchDatePresetOptions,
  batchDirectionOptions,
  getBatchDateRange,
  batchStatusClass,
  batchStatusLabel,
  batchStatusOptions,
  formatBatchDateTime,
  formatBatchMoney,
} from "../lib/batchFormat";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";

const BatchesPage = () => {
  const navigate = useNavigate();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "batches",
    defaultLimit: 10,
  });
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [direction, setDirection] = useState<BatchDirection | "">("");
  const [datePreset, setDatePreset] = useState<BatchDatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const params = useMemo(() => {
    const range = datePreset === "custom"
      ? {
          from: customFrom ? `${customFrom}T00:00:00` : undefined,
          to: customTo ? `${customTo}T23:59:59` : undefined,
        }
      : getBatchDateRange(datePreset);

    return {
      status,
      direction,
      datePreset,
      page,
      limit,
      ...range,
    };
  }, [customFrom, customTo, datePreset, direction, limit, page, status]);

  const { data, isLoading, isError } = useBatches(params);

  const columns: ColumnConfig<Batch>[] = useMemo(
    () => [
      {
        key: "id",
        label: "ID",
        sortable: true,
        render: (value) => <span className="font-black text-maindark dark:text-white">{String(value)}</span>,
      },
      {
        key: "from_branch",
        label: "Filialdan",
        render: (_, row) => row.from_branch.name,
      },
      {
        key: "to_branch",
        label: "Qayerga",
        render: (_, row) => row.to_branch.name,
      },
      {
        key: "orders_count",
        label: "Nechta order",
        sortable: true,
        render: (value) => `${Number(value)} ta`,
      },
      {
        key: "total_price",
        label: "Umumiy narx",
        sortable: true,
        render: (value) => formatBatchMoney(Number(value)),
      },
      {
        key: "status",
        label: "Holat",
        render: (_, row) => (
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${batchStatusClass[row.status]}`}>
            {batchStatusLabel[row.status]}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Yaratilgan vaqt",
        sortable: true,
        render: (value) => formatBatchDateTime(String(value)),
      },
    ],
    [],
  );

  return (
    <div className="min-h-full rounded-2xl bg-sidebar p-4 md:p-6 dark:bg-maindark">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <HeaderName
          name="Paketlar"
          description="Filial va HQ xodimlari yaratgan paketlar ro'yxati"
          icon={<PackageSearch />}
        />
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary px-4 py-3 text-sm font-bold text-[color:var(--color-text-muted)] shadow-sm dark:bg-primarydark dark:text-white/70">
          <CalendarDays size={17} />
          {data?.meta.total ?? data?.total ?? 0} paket
        </div>
      </div>

      <section className="mb-5 rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-primarydark">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <FilterSelect
            name="batch_status"
            label="Holat"
            value={status}
            onChange={(value) => setStatus(value as BatchStatus | "")}
            placeholder="Barchasi"
            options={[...batchStatusOptions]}
          />
          <FilterSelect
            name="batch_direction"
            label="Yo'nalish"
            value={direction}
            onChange={(value) => setDirection(value as BatchDirection | "")}
            placeholder="Barchasi"
            options={[...batchDirectionOptions]}
          />
          <FilterSelect
            name="batch_date"
            label="Sana"
            value={datePreset}
            onChange={(value) => setDatePreset(value as BatchDatePreset)}
            options={[...batchDatePresetOptions]}
          />
          {datePreset === "custom" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)] dark:text-white/60">
                  Dan
                </span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-12 w-full cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:border-primarydark/30 dark:bg-maindark dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)] dark:text-white/60">
                  Gacha
                </span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-12 w-full cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:border-primarydark/30 dark:bg-maindark dark:text-white"
                />
              </label>
            </>
          ) : null}
        </div>
      </section>

      {isError ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-6 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          Paketlar ro'yxatini yuklab bo'lmadi
        </div>
      ) : null}

      <Table
        data={data?.data ?? []}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="Paket topilmadi"
        onRowClick={(row) => navigate(`/batches/${row.id}`)}
      />

      {!isError && data?.meta ? (
        <Pagination
          className="mt-4"
          totalItems={data.meta.total}
          itemsPerPage={data.meta.limit}
          currentPage={data.meta.page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      ) : null}
    </div>
  );
};

export default memo(BatchesPage);
