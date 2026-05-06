import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight, MapPin, Package, PackageSearch, TrendingUp } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import FilterSelect from "../../../shared/ui/FilterSelect";
import FilterPanel from "../../../shared/ui/FilterPanel";
import QuickDateRangeFilter from "../../../shared/ui/QuickDateRangeFilter";
import PageStatBadge from "../../../shared/ui/PageStatBadge";
import EmptyState from "../../../shared/ui/EmptyState";
import { useBatches, type Batch, type BatchDirection, type BatchStatus } from "../../../entities/batch";
import {
  batchDirectionOptions,
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

const batchCardStatusClass: Record<BatchStatus, string> = {
  new: "border-sky-100/70 bg-sky-50 text-sky-700 shadow-sky-950/10",
  on_the_way: "border-amber-100/80 bg-amber-50 text-amber-800 shadow-amber-950/10",
  received: "border-emerald-100/80 bg-emerald-50 text-emerald-800 shadow-emerald-950/10",
  cancelled: "border-rose-100/80 bg-rose-50 text-rose-800 shadow-rose-950/10",
};

const BatchCard = memo(({ batch, onOpen }: { batch: Batch; onOpen: () => void }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === "Enter") onOpen();
    }}
    className="group relative cursor-pointer overflow-hidden rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm shadow-emerald-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-950/20"
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,rgba(255,255,255,0.09)_50%,transparent_62%)] opacity-0 transition-opacity group-hover:opacity-100" />
    <div className="relative z-10 flex min-h-[138px] flex-col gap-2.5 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/18 text-white backdrop-blur-sm">
          <PackageSearch size={16} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-extrabold shadow-sm backdrop-blur ${batchCardStatusClass[batch.status]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {batchStatusLabel[batch.status]}
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/12 transition-colors group-hover:bg-white/22">
            <ChevronRight size={14} className="text-white" />
          </div>
        </div>
      </div>

      <div>
        <p className="m-0 text-xs font-semibold text-white/70">{formatBatchDisplayId(batch.id)}</p>
        <h3 className="m-0 mt-0.5 truncate text-base font-bold leading-tight text-white">
          {batch.from_branch.name} → {batch.to_branch.name}
        </h3>
      </div>

      <div className="h-px w-full bg-white/20" />

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex min-w-0 items-center gap-1 text-xs text-white/70">
            <Package size={12} className="text-white/50" />
            Orderlar:
          </span>
          <span className="text-xs font-bold text-white">{batch.orders_count} ta</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-white/70">Summa:</span>
          <span className="text-xs font-bold text-white">{formatBatchCompactMoney(batch.total_price)}</span>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-white/70">
            <MapPin size={12} className="text-white/50" />
            Yo'nalish:
          </span>
          <span className="truncate text-xs font-bold text-white">{batchDirectionOptions.find((item) => item.value === batch.direction)?.label ?? batch.direction}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5 text-[11px] text-white/60">
        <span className="flex items-center gap-1.5">
          <TrendingUp size={11} />
          {formatBatchDateTime(batch.created_at)}
        </span>
      </div>
    </div>
  </div>
));
BatchCard.displayName = "BatchCard";

const BatchCardSkeleton = memo(() => (
  <div className="h-[138px] animate-pulse rounded-xl bg-emerald-500/20 dark:bg-emerald-800/30" />
));
BatchCardSkeleton.displayName = "BatchCardSkeleton";

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
          onChange={(value) => {
            setStatus(value as BatchStatus | "");
            setPage(1);
          }}
          placeholder="Barchasi"
          options={[...batchStatusOptions]}
        />
        <FilterSelect
          name="batch_direction"
          label="Yo'nalish"
          value={direction}
          onChange={(value) => {
            setDirection(value as BatchDirection | "");
            setPage(1);
          }}
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
              setPage(1);
            }}
            onClear={() => {
              setFromDate("");
              setToDate("");
              setPage(1);
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

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,270px))] gap-3">
          {Array.from({ length: limit }).map((_, index) => (
            <BatchCardSkeleton key={index} />
          ))}
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-6 dark:bg-primarydark">
          <EmptyState
            icon="📦"
            title="Paketlar yo'q"
            description="Hozircha bu filterlar bo'yicha paketlar topilmadi."
            className="border-0 bg-transparent shadow-none"
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,270px))] gap-3">
          {(data?.data ?? []).map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              onOpen={() => navigate(`/batches/${batch.id}`)}
            />
          ))}
        </div>
      )}

      {!isError && data?.meta ? (
        <Pagination
          className="mt-5 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/55 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
          totalItems={data.meta.total}
          itemsPerPage={data.meta.limit}
          currentPage={data.meta.page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          pageSizeOptions={[10, 20, 50, 100]}
          hideSinglePageControls
          compact
        />
      ) : null}
    </div>
  );
};

export default memo(BatchesPage);
