import { memo, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock, MapPin, Package, PackageSearch, RotateCcw, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import PageStatBadge from "../../../shared/ui/PageStatBadge";
import EmptyState from "../../../shared/ui/EmptyState";
import { useBatches, type Batch, type BatchDirection, type BatchStatus } from "../../../entities/batch";
import {
  formatBatchDateTime,
  formatBatchCompactMoney,
  formatBatchDisplayId,
} from "../lib/batchFormat";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";

type BatchTabKey = "new" | "old" | "return";

interface BatchTabItem {
  key: BatchTabKey;
  labelKey: "tabs.new" | "tabs.old" | "tabs.return";
  icon: ReactNode;
  status: BatchStatus | "";
  direction: BatchDirection | "";
  activeClassName: string;
  inactiveIconClassName: string;
}

const batchTabs: BatchTabItem[] = [
  {
    key: "new",
    labelKey: "tabs.new",
    icon: <Package size={18} />,
    status: "new",
    direction: "forward",
    activeClassName: "border-success bg-success text-primary shadow-lg shadow-success/25",
    inactiveIconClassName: "bg-success/10 text-success",
  },
  {
    key: "old",
    labelKey: "tabs.old",
    icon: <Clock size={18} />,
    status: "received",
    direction: "forward",
    activeClassName: "border-main bg-main text-primary shadow-lg shadow-main/25",
    inactiveIconClassName: "bg-main/10 text-main",
  },
  {
    key: "return",
    labelKey: "tabs.return",
    icon: <RotateCcw size={18} />,
    status: "",
    direction: "return",
    activeClassName: "border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-500/25",
    inactiveIconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
];

const batchCardStatusClass: Record<BatchStatus, string> = {
  new: "border-sky-100/70 bg-sky-50 text-sky-700 shadow-sky-950/10",
  on_the_way: "border-amber-100/80 bg-amber-50 text-amber-800 shadow-amber-950/10",
  received: "border-emerald-100/80 bg-emerald-50 text-emerald-800 shadow-emerald-950/10",
  cancelled: "border-rose-100/80 bg-rose-50 text-rose-800 shadow-rose-950/10",
};

const BatchCard = memo(({
  batch,
  onOpen,
  statusLabel,
  directionLabel,
  labels,
}: {
  batch: Batch;
  onOpen: () => void;
  statusLabel: string;
  directionLabel: string;
  labels: {
    orders: string;
    piece: string;
    amount: string;
    direction: string;
  };
}) => (
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
            {statusLabel}
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
            {labels.orders}:
          </span>
          <span className="text-xs font-bold text-white">{batch.orders_count} {labels.piece}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-white/70">{labels.amount}:</span>
          <span className="text-xs font-bold text-white">{formatBatchCompactMoney(batch.total_price)}</span>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-white/70">
            <MapPin size={12} className="text-white/50" />
            {labels.direction}:
          </span>
          <span className="truncate text-xs font-bold text-white">{directionLabel}</span>
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
  const { t } = useTranslation(["batches", "common"]);
  const navigate = useNavigate();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "batches",
    defaultLimit: 10,
  });
  const [status, setStatus] = useState<BatchStatus | "">("new");
  const [direction, setDirection] = useState<BatchDirection | "">("forward");

  const activeTab = useMemo(() => {
    if (direction === "return") return "return";
    if (status === "received" && direction === "forward") return "old";
    if (status === "new" && direction === "forward") return "new";
    return "";
  }, [direction, status]);

  const handleTabChange = (tab: BatchTabItem) => {
    setStatus(tab.status);
    setDirection(tab.direction);
    setPage(1);
  };

  const params = useMemo(() => {
    return {
      status,
      direction,
      page,
      limit,
    };
  }, [direction, limit, page, status]);

  const { data, isLoading, isError } = useBatches(params);
  const statusLabels = useMemo<Record<BatchStatus, string>>(
    () => ({
      new: t("status.new"),
      on_the_way: t("status.onTheWay"),
      received: t("status.received"),
      cancelled: t("status.cancelled"),
    }),
    [t],
  );
  const directionLabels = useMemo<Record<BatchDirection, string>>(
    () => ({
      forward: t("direction.forward"),
      return: t("direction.return"),
    }),
    [t],
  );
  const cardLabels = useMemo(
    () => ({
      orders: t("card.orders"),
      piece: t("card.piece"),
      amount: t("card.amount"),
      direction: t("card.direction"),
    }),
    [t],
  );

  return (
    <div className="min-h-full rounded-2xl p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <HeaderName
          name={t("title")}
          description={t("description")}
          icon={<PackageSearch />}
        />
        <PageStatBadge icon={<CalendarDays size={17} />}>
          {t("statBadge", { count: data?.meta.total ?? data?.total ?? 0 })}
        </PageStatBadge>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {batchTabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                isActive
                  ? tab.activeClassName
                  : "border-gray-200 bg-primary text-gray-600 shadow-sm hover:border-main/20 dark:border-white/10 dark:bg-primarydark dark:text-gray-300"
              }`}
              aria-pressed={isActive}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-primary/15 text-primary" : tab.inactiveIconClassName
                }`}
              >
                {tab.icon}
              </span>
              <span className="text-sm font-semibold leading-snug">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-6 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          {t("loadError")}
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
            title={t("emptyTitle")}
            description={t("emptyDescription")}
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
              statusLabel={statusLabels[batch.status]}
              directionLabel={directionLabels[batch.direction]}
              labels={cardLabels}
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
