import { memo, useCallback, useMemo, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock, MapPin, Package, PackageSearch, RotateCcw, TrendingUp, WalletCards } from "lucide-react";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import PageStatBadge from "../../../shared/ui/PageStatBadge";
import EmptyState from "../../../shared/ui/EmptyState";
import { useBatches, type Batch, type BatchDirection, type BatchStatus } from "../../../entities/batch";
import { useBranches } from "../../../entities/branch";
import {
  formatBatchDateTime,
  formatBatchCompactMoney,
  formatBatchDisplayId,
} from "../lib/batchFormat";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";
import PageContainer from "../../../shared/ui/PageContainer";

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
    activeClassName: "border-slate-500 bg-slate-600 text-white shadow-lg shadow-slate-700/25",
    inactiveIconClassName: "bg-slate-500/10 text-slate-500 dark:text-slate-300",
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

const batchCardClass: Record<BatchTabKey, string> = {
  new: "border-emerald-300/20 bg-linear-to-br from-emerald-500 to-emerald-700 shadow-emerald-950/10 hover:shadow-emerald-950/20",
  old: "border-slate-300/20 bg-linear-to-br from-slate-500 to-slate-700 shadow-slate-950/10 hover:shadow-slate-950/20",
  return: "border-amber-300/20 bg-linear-to-br from-amber-500 to-amber-700 shadow-amber-950/10 hover:shadow-amber-950/20",
};

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
  tone,
}: {
  batch: Batch;
  onOpen: () => void;
  statusLabel: string;
  directionLabel: string;
  tone: BatchTabKey;
  labels: {
    orders: string;
    piece: string;
    amount: string;
    direction: string;
    route: string;
    region: string;
    created: string;
  };
}) => {
  const branchNames = [batch.from_branch.name, batch.to_branch.name].filter(
    (name) => name && name !== "—" && !/^Filial #\S+$/i.test(name),
  );
  const routeLabel = branchNames.join(" → ");
  const regionLabel =
    batch.to_branch.region && batch.to_branch.region !== "—"
      ? batch.to_branch.region
      : batch.to_branch.name && batch.to_branch.name !== "—"
        ? batch.to_branch.name
        : directionLabel;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative min-h-52 cursor-pointer overflow-hidden rounded-2xl border p-0 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-main/35 ${batchCardClass[tone]}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(105deg,transparent_38%,rgba(255,255,255,0.1)_50%,transparent_62%)] opacity-70 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 flex min-h-52 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/18 text-white backdrop-blur-sm">
              <PackageSearch size={19} />
            </div>
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
                {formatBatchDisplayId(batch.id)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold shadow-sm backdrop-blur ${batchCardStatusClass[batch.status]}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/12 transition-colors group-hover:bg-white/24">
              <ChevronRight size={16} className="text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
            <MapPin size={12} />
            {labels.region}
          </div>
          <p className="m-0 min-h-5 truncate text-base font-black text-white">
            {regionLabel}
          </p>
          {routeLabel ? (
            <p className="m-0 mt-1 truncate text-[11px] font-semibold text-white/55">
              {labels.route}: {routeLabel}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
              <Package size={12} />
              {labels.orders}
            </span>
            <strong className="mt-0.5 block text-base font-black text-white">
              {batch.orders_count} {labels.piece}
            </strong>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
              <WalletCards size={12} />
              {labels.amount}
            </span>
            <strong className="mt-0.5 block truncate text-base font-black text-white">
              {formatBatchCompactMoney(batch.total_price)}
            </strong>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/15 pt-2.5 text-[11px] font-semibold text-white/65">
          <span className="flex items-center gap-1.5">
            <TrendingUp size={11} />
            {labels.created}
          </span>
          <span>{formatBatchDateTime(batch.created_at)}</span>
        </div>
      </div>
    </button>
  );
});
BatchCard.displayName = "BatchCard";

const batchSkeletonClass: Record<BatchTabKey, string> = {
  new: "bg-emerald-500/20 dark:bg-emerald-800/30",
  old: "bg-slate-500/20 dark:bg-slate-700/30",
  return: "bg-amber-500/20 dark:bg-amber-800/30",
};

const BatchCardSkeleton = memo(({ tone }: { tone: BatchTabKey }) => (
  <div className={`h-52 animate-pulse rounded-2xl ${batchSkeletonClass[tone]}`} />
));
BatchCardSkeleton.displayName = "BatchCardSkeleton";

const BatchesPage = () => {
  const { t } = useTranslation(["batches", "common"]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "batches",
    defaultLimit: 10,
  });
  const tabParam = searchParams.get("tab");
  const activeTab: BatchTabKey =
    tabParam === "old" || tabParam === "return" ? tabParam : "new";
  const activeTabConfig = batchTabs.find((tab) => tab.key === activeTab) ?? batchTabs[0];
  const status = activeTabConfig.status;
  const direction = activeTabConfig.direction;

  const handleTabChange = (tab: BatchTabItem) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", tab.key);
      next.set("page", "1");
      return next;
    }, { replace: true });
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
  const needsBranchNames = useMemo(
    () =>
      (data?.data ?? []).some((batch) =>
        [batch.from_branch.name, batch.to_branch.name].some(
          (name) => name === "—" || /^Filial #\S+$/i.test(name),
        ),
      ),
    [data?.data],
  );
  const { data: branchesResponse } = useBranches({ page: 1, limit: 1000 }, needsBranchNames);
  const branchNames = useMemo(
    () => new Map((branchesResponse?.data ?? []).map((branch) => [String(branch.id), branch.name])),
    [branchesResponse?.data],
  );
  const resolveBranchName = useCallback(
    (id: string, name: string) =>
      name === "—" || /^Filial #\S+$/i.test(name)
        ? branchNames.get(id) ?? "—"
        : name,
    [branchNames],
  );
  const batches = useMemo(
    () =>
      (data?.data ?? []).map((batch) => ({
        ...batch,
        from_branch: {
          ...batch.from_branch,
          name: resolveBranchName(batch.from_branch.id, batch.from_branch.name),
        },
        to_branch: {
          ...batch.to_branch,
          name: resolveBranchName(batch.to_branch.id, batch.to_branch.name),
        },
      })),
    [data?.data, resolveBranchName],
  );
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
      route: t("card.route"),
      region: t("card.region"),
      created: t("card.created"),
    }),
    [t],
  );

  return (
    <PageContainer>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3 xl:grid-cols-[repeat(auto-fill,minmax(230px,270px))]">
          {Array.from({ length: limit }).map((_, index) => (
            <BatchCardSkeleton key={index} tone={activeTab} />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-(--color-border-soft) bg-primary p-6 dark:bg-primarydark">
          <EmptyState
            icon="📦"
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            className="border-0 bg-transparent shadow-none"
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3 xl:grid-cols-[repeat(auto-fill,minmax(230px,270px))]">
          {batches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              onOpen={() => navigate(`/batches/${batch.id}`)}
              statusLabel={statusLabels[batch.status]}
              directionLabel={directionLabels[batch.direction]}
              tone={activeTab}
              labels={cardLabels}
            />
          ))}
        </div>
      )}

      {!isError && data?.meta ? (
        <Pagination
          className="mt-5 rounded-2xl border border-(--color-border-soft) bg-white/55 px-3 py-2 dark:border-white/10 dark:bg-white/4"
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
    </PageContainer>
  );
};

export default memo(BatchesPage);
