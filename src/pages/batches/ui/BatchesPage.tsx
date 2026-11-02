// dizayn-v2: superadmin-batches-new, superadmin-batches-old, superadmin-batches-return, admin-batches-new, admin-batches-old, admin-batches-return, manager-batches-new, manager-batches-old, manager-batches-return
import { lazy, memo, useCallback, useMemo } from "react";
import { ArrowRight, ChevronRight, Inbox } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { BATCH_STATUS_TONE, useBatches, type Batch } from "../../../entities/batch";
import { useBranches } from "../../../entities/branch";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { usePagination } from "../../../shared/lib/usePagination";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  Tabs,
  type DataTableColumn,
  type TabItem,
} from "../../../shared/ui/primitives";
import { OpsSection } from "../../ops/ui/OpsSection";
import { formatBatchDisplayId } from "../lib/batchFormat";
import {
  BATCH_TAB_KEYS,
  BATCH_TAB_PARAMS,
  isPlaceholderBranchName,
  knownText,
  parseBatchTab,
  readBatchRegion,
  type BatchDetailLocationState,
  type BatchTabKey,
} from "../model/batchView";

/** «Filiallar — operatsiyalar» — faqat superadmin (F2NzXpMv, Ops'dan ko'chgan); kodi alohida bo'lakda. */
const BranchOpsPage = lazy(() => import("../../branch-ops"));

/** Havola ko'rinishidagi ikonka-tugma (`.el-iconbtn-sm`, ghost) — telefonda 44 px. */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";

const PAGE_SIZES = [10, 20, 50, 100] as const;

/** «Chilonzor qabul punkti → Toshkent HQ» (nomi noma'lum tomon tushiriladi). */
const RouteLine = ({ from, to, className }: { from: string | null; to: string | null; className?: string }) => (
  <span className={className}>
    {from}
    {from && to ? (
      <ArrowRight aria-hidden="true" size={14} strokeWidth={2} className="mx-1.5 inline shrink-0 align-[-2px] text-text-subtle" />
    ) : null}
    {to}
  </span>
);

/**
 * PAKETLAR — `/batches` (superadmin, admin, menejer HQ · PICKUP · HYBRID), dizayn v2.
 *
 * Sarlavha «Paketlar» + faol tab soni; karta: tablar «Yangi · Eski · Qaytarilgan» (har biri soni bilan, `?tab=`),
 * jadval (planshetda viloyat marshrut ostida, buyurtmalar soni summa ostida; telefonda kartalar), sahifalash.
 * Qator → `/batches/:id` (holat `{ from: "batches", fromSearch }` — tafsilotdan shu tab va sahifaga qaytiladi).
 *
 * So'rov: `GET transfer-batches?status&direction&page&limit` (tab paramlari — `BATCH_TAB_PARAMS`, v1 dagidek);
 * tab sonlari — har tab uchun `limit=1` so'rovining `meta.total` i (faol tabniki asosiy so'rovdan).
 * Filial nomi ro'yxatda kelmasa («—», «Filial #12») — `GET branches` dan (v1 dagidek).
 */
const BatchesPage = () => {
  const { t, i18n } = useTranslation(["batches", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, setPage, setLimit } = usePagination({ key: "batches", defaultLimit: 10 });
  const activeTab = parseBatchTab(searchParams.get("tab"));

  const handleTabChange = useCallback(
    (tab: BatchTabKey) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("tab", tab);
          next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const params = useMemo(() => ({ ...BATCH_TAB_PARAMS[activeTab], page, limit }), [activeTab, limit, page]);
  const batchesQuery = useBatches(params);
  const { data, isLoading, isError, error, refetch } = batchesQuery;

  // Tab sonlari: faol tabniki asosiy so'rovdan, qolganlari — `limit=1` (faqat `meta.total` kerak).
  const newCount = useBatches({ ...BATCH_TAB_PARAMS.new, page: 1, limit: 1 }, { enabled: activeTab !== "new" });
  const oldCount = useBatches({ ...BATCH_TAB_PARAMS.old, page: 1, limit: 1 }, { enabled: activeTab !== "old" });
  const returnCount = useBatches({ ...BATCH_TAB_PARAMS.return, page: 1, limit: 1 }, { enabled: activeTab !== "return" });
  // Tab almashganda asosiy so'rov kelguncha — o'sha tabning (keshdagi) son so'rovi: son va izoh yo'qolib qolmaydi.
  const countTotals: Record<BatchTabKey, number | undefined> = {
    new: newCount.data?.meta.total,
    old: oldCount.data?.meta.total,
    return: returnCount.data?.meta.total,
  };
  const activeTotal = data?.meta.total ?? countTotals[activeTab];
  const tabCounts: Record<BatchTabKey, number | undefined> = { ...countTotals, [activeTab]: activeTotal };

  // Filial nomi zaxirasi (v1 dagidek): ro'yxatda nom yo'q bo'lsa — `GET branches` dan id bo'yicha.
  const needsBranchNames = useMemo(
    () =>
      (data?.data ?? []).some(
        (batch) => isPlaceholderBranchName(batch.from_branch.name) || isPlaceholderBranchName(batch.to_branch.name),
      ),
    [data?.data],
  );
  // `GET branches` — faqat superadmin va admin (backend `@Roles(SUPERADMIN, ADMIN)`): menejer so'rov yubormaydi.
  const role = useSelector((state: RootState) => state.role.role);
  const canLookupBranches = role === "superadmin" || role === "admin";
  const { data: branchesResponse } = useBranches({ page: 1, limit: 1000 }, needsBranchNames && canLookupBranches);
  const branchNames = useMemo(
    () => new Map((branchesResponse?.data ?? []).map((branch) => [String(branch.id), branch.name])),
    [branchesResponse?.data],
  );
  const resolveBranchName = useCallback(
    (id: string, name: string) => (isPlaceholderBranchName(name) ? (branchNames.get(id) ?? "—") : name),
    [branchNames],
  );
  const rows = useMemo<Batch[] | undefined>(
    () =>
      data?.data.map((batch) => ({
        ...batch,
        from_branch: { ...batch.from_branch, name: resolveBranchName(batch.from_branch.id, batch.from_branch.name) },
        to_branch: { ...batch.to_branch, name: resolveBranchName(batch.to_branch.id, batch.to_branch.name) },
      })),
    [data?.data, resolveBranchName],
  );

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);

  const linkState = useMemo<BatchDetailLocationState>(
    () => ({ from: "batches", fromSearch: location.search }),
    [location.search],
  );
  const batchHref = useCallback((batch: Batch) => `/batches/${encodeURIComponent(batch.id)}`, []);

  const statusBadge = useCallback(
    (batch: Batch) => (
      <Badge tone={BATCH_STATUS_TONE[batch.status]} dot>
        {t(`batchStatus.${batch.status}`, { ns: "newOrders" })}
      </Badge>
    ),
    [t],
  );

  const ordersSub = useCallback(
    (batch: Batch) => t("ordersSub", { count: batch.orders_count, value: count(batch.orders_count) }),
    [count, t],
  );

  const columns = useMemo<DataTableColumn<Batch>[]>(
    () => [
      {
        id: "batch",
        header: t("columns.batch"),
        cell: (batch) => (
          <>
            <Link
              to={batchHref(batch)}
              state={linkState}
              className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
            >
              {formatBatchDisplayId(batch.id)}
            </Link>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(batch.created_at)}</div>
          </>
        ),
      },
      {
        id: "route",
        header: t("columns.route"),
        cell: (batch) => {
          const from = knownText(batch.from_branch.name);
          const to = knownText(batch.to_branch.name);
          const region = readBatchRegion(batch);
          return (
            <>
              <RouteLine from={from} to={to} className="max-lg:hidden" />
              {/* Planshet: «from» va ostida «→ to · viloyat» (maket `.el-show-tablet`). */}
              <span className="hidden min-w-0 flex-col max-lg:flex">
                <span>{from ?? to ?? "—"}</span>
                {from && (to || region) ? (
                  <span className="text-[13px] text-text-muted">
                    {to ? (
                      <>
                        <ArrowRight aria-hidden="true" size={14} strokeWidth={2} className="mr-1 inline align-[-2px] text-text-subtle" />
                        {to}
                      </>
                    ) : null}
                    {to && region ? " · " : null}
                    {region}
                  </span>
                ) : null}
              </span>
            </>
          );
        },
      },
      {
        id: "region",
        header: t("columns.region"),
        hideBelow: "lg",
        cell: (batch) => readBatchRegion(batch) ?? "—",
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: statusBadge,
      },
      {
        id: "orders",
        header: t("columns.orders"),
        align: "end",
        hideBelow: "lg",
        cell: (batch) => t("qty", { value: count(batch.orders_count) }),
      },
      {
        id: "amount",
        header: t("columns.amount"),
        align: "end",
        cell: (batch) => (
          <>
            <div className="font-semibold text-text">{money(batch.total_price)}</div>
            <div className="hidden text-[13px] text-text-muted max-lg:block">{ordersSub(batch)}</div>
          </>
        ),
      },
      {
        id: "open",
        header: <span className="sr-only">{t("columns.open")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (batch) => {
          const label = t("open", { id: formatBatchDisplayId(batch.id) });
          return (
            <Link to={batchHref(batch)} state={linkState} aria-label={label} title={label} className={ICON_LINK}>
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
            </Link>
          );
        },
      },
    ],
    [batchHref, count, dateTime, linkState, money, ordersSub, statusBadge, t],
  );

  // Telefon kartasi: butun karta — paket tafsilotiga havola, o'ngda «›».
  const renderCard = useCallback(
    (batch: Batch) => {
      const from = knownText(batch.from_branch.name);
      const to = knownText(batch.to_branch.name);
      const region = readBatchRegion(batch);
      return (
        <Link
          to={batchHref(batch)}
          state={linkState}
          aria-label={t("open", { id: formatBatchDisplayId(batch.id) })}
          className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 justify-between gap-2">
              <span className="min-w-0 font-semibold">{formatBatchDisplayId(batch.id)}</span>
              <span className="whitespace-nowrap font-semibold">{money(batch.total_price)}</span>
            </span>
            <span className="text-[13px] text-text-muted">
              {from || to ? (
                <>
                  <RouteLine from={from} to={to} />
                  {" · "}
                </>
              ) : null}
              {region ? <>{region} · </> : null}
              <span className="whitespace-nowrap">{ordersSub(batch)}</span>
              {" · "}
              <span className="whitespace-nowrap">{dateTime(batch.created_at)}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">{statusBadge(batch)}</span>
          </span>
          <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-subtle" />
        </Link>
      );
    },
    [batchHref, dateTime, linkState, money, ordersSub, statusBadge, t],
  );

  const tabItems: TabItem<BatchTabKey>[] = BATCH_TAB_KEYS.map((key) => ({
    value: key,
    label: t(`tabs.${key}`),
    count: tabCounts[key],
  }));

  const descriptionKey = activeTab === "return" ? "descriptionReturn" : "description";
  const description =
    activeTotal !== undefined ? (
      <Trans
        t={t}
        i18nKey={descriptionKey}
        values={{ value: count(activeTotal) }}
        count={activeTotal}
        components={{
          page: <Link to="/returns" className="font-semibold text-action-fg hover:text-action-hover hover:underline" />,
        }}
      />
    ) : isLoading ? (
      <Skeleton width={320} height={14} />
    ) : null;

  const meta = data?.meta;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={description} />

      <Card
        as="section"
        padding="none"
        aria-label={t("listLabel")}
        footer={
          meta && meta.total > 0 ? (
            <Pagination
              page={meta.page || page}
              pageSize={meta.limit || limit}
              total={meta.total}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              pageSizeOptions={PAGE_SIZES}
              summary={(range) => t("pagination", range)}
            />
          ) : undefined
        }
      >
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={handleTabChange}
          ariaLabel={t("tabsLabel")}
          listClassName="px-3"
        />

        <QueryBoundary
          query={{ data: rows, isLoading, isError, error, refetch }}
          loadingLabel={t("loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[t("columns.batch"), t("columns.route"), t("columns.status"), t("columns.amount")]}
              rows={6}
            />
          }
          empty={<EmptyState icon={Inbox} title={t("emptyTitle")} description={t("emptyDescription")} />}
          error={(queryError, retry) => <ErrorState error={queryError} title={t("loadError")} onRetry={retry} />}
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(batch) => batch.id}
              label={t("listLabel")}
              cardsLabel={t("cardsLabel")}
              onRowClick={(batch) => navigate(batchHref(batch), { state: linkState })}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>

      {role === "superadmin" ? (
        <OpsSection>
          <BranchOpsPage />
        </OpsSection>
      ) : null}
    </div>
  );
};

export default memo(BatchesPage);
