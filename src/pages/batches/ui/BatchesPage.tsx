import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, PackageSearch } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import { Table } from "../../../shared/components/Table/Table";
import FilterSelect from "../../../shared/ui/FilterSelect";
import FilterPanel from "../../../shared/ui/FilterPanel";
import QuickDateRangeFilter from "../../../shared/ui/QuickDateRangeFilter";
import PageStatBadge from "../../../shared/ui/PageStatBadge";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useBatches, type Batch, type BatchDirection, type BatchStatus } from "../../../entities/batch";
import {
  batchDirectionOptions,
  batchStatusClass,
  batchStatusLabel,
  batchStatusOptions,
  formatBatchDateTime,
  formatBatchCompactMoney,
  formatBatchDisplayId,
} from "../lib/batchFormat";
import Pagination from "../../../shared/components/pagination";
import { getTodayRange, toApiDateTimeRange } from "../../../shared/lib/dateRange";
import { usePagination } from "../../../shared/lib/usePagination";

const initialBatchDateRange = getTodayRange();

const BatchesPage = () => {
  const navigate = useNavigate();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "batches",
    defaultLimit: 10,
  });
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [direction, setDirection] = useState<BatchDirection | "">("");
  const [fromDate, setFromDate] = useState(initialBatchDateRange.from);
  const [toDate, setToDate] = useState(initialBatchDateRange.to);

  const params = useMemo(() => {
    return {
      status,
      direction,
      page,
      limit,
      ...toApiDateTimeRange({ from: fromDate, to: toDate }),
    };
  }, [direction, fromDate, limit, page, status, toDate]);

  const { data, isLoading, isError } = useBatches(params);

  const columns: ColumnConfig<Batch>[] = useMemo(
    () => [
      {
        key: "id",
        label: "ID",
        sortable: true,
        render: (value) => (
          <span className="font-black text-maindark dark:text-white">
            {formatBatchDisplayId(String(value))}
          </span>
        ),
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
        render: (value) => formatBatchCompactMoney(Number(value)),
      },
      {
        key: "status",
        label: "Holat",
        render: (_, row) => (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${batchStatusClass[row.status]}`}>
            <span className="h-2 w-2 rounded-full bg-current" />
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
    <div className="min-h-full rounded-2xl p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <HeaderName
          name="Paketlar"
          description="Filial va HQ xodimlari yaratgan paketlar ro'yxati"
          icon={<PackageSearch />}
        />
        <PageStatBadge icon={<CalendarDays size={17} />}>
          {data?.meta.total ?? data?.total ?? 0} paket
        </PageStatBadge>
      </div>

      <FilterPanel gridClassName="md:grid-cols-3">
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
        <div className="relative flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
            Sana
          </span>
          <QuickDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onChange={({ from, to }) => {
              setFromDate(from);
              setToDate(to);
            }}
            onClear={() => {
              setFromDate("");
              setToDate("");
            }}
            placeholder="Dan → Gacha"
            pickerClassName="w-full"
            clearClassName="sm:w-auto"
            size="sm"
            showPicker={false}
            className="rounded-xl border-2 border-white/70 bg-white/85 px-3.5 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/7"
          />
        </div>
      </FilterPanel>

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
