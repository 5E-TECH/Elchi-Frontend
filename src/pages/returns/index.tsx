// dizayn-v2: superadmin-returns-list, admin-returns-list, manager-returns-list
import { memo, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, CircleCheck, Inbox, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { BATCH_STATUS_TONE, type BatchStatus } from "../../entities/batch";
import { API_ENDPOINTS } from "../../shared/api";
import { api } from "../../shared/api/api";
import { queryKeys } from "../../shared/config/queryKeys";
import { getCurrentBranchId } from "../../shared/lib/currentBranch";
import type { ISODateRange } from "../../shared/lib/dateRange";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import { usePagination } from "../../shared/lib/usePagination";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  Skeleton,
  SkeletonTable,
  type DataTableColumn,
  type DataTableSort,
  type SelectOption,
} from "../../shared/ui/primitives";
import { formatBatchDisplayId } from "../batches/lib/batchFormat";
import type { BatchDetailLocationState } from "../batches/model/batchView";
import {
  DEFAULT_RETURN_SORT,
  buildReturnBatchesParams,
  dateFilterToRange,
  rangeToDateFilter,
  readReturnFilters,
  readUserBranchName,
  sortReturnBatches,
  toReturnBatchesResponse,
  writeReturnFilters,
  type ReturnBatch,
  type ReturnBatchSort,
  type ReturnBatchSortKey,
  type ReturnBatchesResponse,
} from "./model/returnBatches";

const PAGE_SIZES = [10, 20, 50, 100] as const;
const BATCH_STATUSES: readonly BatchStatus[] = ["new", "on_the_way", "received", "cancelled"];
const SORT_KEYS: readonly ReturnBatchSortKey[] = ["batch", "from", "to", "status", "orders", "amount"];
/** Sana filtri tez tanlovi: backend `period` qiymatlari + «Barchasi» (filtr yo'q); taqvimda — bitta kun (`date`). */
const DATE_PRESETS = ["today", "week", "month", "all"] as const;

/** Havola ko'rinishidagi ikonka-tugma (`.el-iconbtn-sm`, ghost) — telefonda 44 px. */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";

const known = (value: string) => (value.trim() && value !== "—" ? value : null);

/**
 * QAYTARISHLAR — `/returns` (superadmin, admin, menejer HQ · PICKUP · HYBRID), dizayn v2.
 *
 * Sarlavha «Qaytarishlar» + izoh (menejerda — o'z filiali) va jami son; karta: «Holat» va «Sana» filtrlari (URL
 * bilan sinxron: `?status&period|date`, o'zgarsa sahifa 1 ga qaytadi; telefonda ham qatorda — 2 ta filtr, maket),
 * saralanadigan jadval (joriy sahifa ichida; telefonda kartalar), sahifalash. Qator → `/batches/:id` (holat
 * `{ from: "returns", fromSearch }` — «← Qaytarishlar» filtrlar bilan qaytaradi, ega qarori D20).
 *
 * So'rov: `GET transfer-batches?direction=RETURN&source_branch_id&status&period|date&page&limit` (filial — joriy
 * foydalanuvchi filiali, bo'lmasa hammasi; holat — API qiymati `PENDING|SENT|RECEIVED|CANCELLED`). Sana — qisqartirilgan
 * (ega qarori 2026-10-17 F2): oraliq (from/to) yo'q — faqat Bugun / Bu hafta / Bu oy (`period`) yoki bitta kun (`date`).
 *
 * Ma'lum cheklov (backend, egaga savol Q2): holat bo'sh yoki `PENDING` bo'lsa backend PENDING paketlarni sahifa ichida
 * yig'adi va `meta.total` ni shu sahifadagi qatorlar soni qilib qaytaradi — «jami N ta paket» va sahifalash shu
 * holda to'liq emas. Frontend buni tuzata olmaydi.
 */
const ReturnsPage = () => {
  const { t, i18n } = useTranslation(["returns", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const branchId = useSelector((state: RootState) => getCurrentBranchId(state));
  const userBranchName = useSelector((state: RootState) => readUserBranchName(state.user.user));
  const isManager = role === "manager";
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, setPage, setLimit } = usePagination({ key: "returns", defaultLimit: 10 });
  const [sort, setSort] = useState<ReturnBatchSort | null>(DEFAULT_RETURN_SORT);
  const { status, dateFilter } = useMemo(() => readReturnFilters(searchParams), [searchParams]);
  const activeFilters = (status ? 1 : 0) + (dateFilter ? 1 : 0);

  const params = useMemo(
    () => buildReturnBatchesParams({ page, limit, branchId, status, dateFilter }),
    [branchId, dateFilter, limit, page, status],
  );
  // Tafsilotdan «← Qaytarishlar» shu sahifaga — filtrlar va sahifa bilan (ega qarori D20).
  const linkState = useMemo<BatchDetailLocationState>(
    () => ({ from: "returns", fromSearch: location.search }),
    [location.search],
  );

  const returnsQuery = useQuery({
    queryKey: queryKeys.batches.returns(branchId, params),
    queryFn: async (): Promise<ReturnBatchesResponse> => {
      const response = await api.get(API_ENDPOINTS.BATCHES.BASE, { params }).then((res) => res.data);
      return toReturnBatchesResponse(response, params);
    },
    placeholderData: (previous) => previous,
  });
  const { data, isLoading, isError, error, refetch } = returnsQuery;

  const rows = useMemo(() => (data ? sortReturnBatches(data.data, sort) : undefined), [data, sort]);

  const handleStatusChange = useCallback(
    (next: string | null) =>
      setSearchParams((prev) => writeReturnFilters(prev, { status: (next ?? "") as BatchStatus | "" }), {
        replace: true,
      }),
    [setSearchParams],
  );
  const handleDateChange = useCallback(
    (range: ISODateRange) =>
      setSearchParams((prev) => writeReturnFilters(prev, { dateFilter: rangeToDateFilter(range) }), { replace: true }),
    [setSearchParams],
  );
  const clearFilters = useCallback(
    () => setSearchParams((prev) => writeReturnFilters(prev, { status: "", dateFilter: null }), { replace: true }),
    [setSearchParams],
  );
  const dateValue = useMemo(() => dateFilterToRange(dateFilter), [dateFilter]);

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback(
    (value: string) => (value ? formatDateTimeLocalized(value, { language }) : "—"),
    [language],
  );
  const batchHref = useCallback((batch: ReturnBatch) => `/batches/${encodeURIComponent(batch.id)}`, []);
  const qty = useCallback((value: number) => t("qty", { value: count(value) }), [count, t]);

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("filters.all") },
      ...BATCH_STATUSES.map((value) => ({ value, label: t(`batchStatus.${value}`, { ns: "newOrders" }) })),
    ],
    [t],
  );

  const statusBadge = useCallback(
    (batch: ReturnBatch) => (
      <Badge tone={BATCH_STATUS_TONE[batch.status]} dot>
        {t(`batchStatus.${batch.status}`, { ns: "newOrders" })}
      </Badge>
    ),
    [t],
  );

  const routeTo = useCallback(
    (batch: ReturnBatch) => {
      const to = known(batch.toBranch);
      return to ? (
        <span className="inline-flex items-center gap-1">
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-text-subtle" />
          {to}
        </span>
      ) : null;
    },
    [],
  );

  const columns = useMemo<DataTableColumn<ReturnBatch>[]>(() => {
    const list: DataTableColumn<ReturnBatch>[] = [
      {
        id: "batch",
        header: t("columns.batch"),
        sortable: true,
        firstDirection: "desc",
        cell: (batch) => (
          <>
            <Link
              to={batchHref(batch)}
              state={linkState}
              className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
            >
              {formatBatchDisplayId(batch.id)}
            </Link>
            <div className="whitespace-nowrap text-[13px] text-text-muted">
              {/* Planshetda buyurtmalar ustuni yashirin — soni sana oldida (maket `.el-show-tablet`). */}
              {isManager ? null : <span className="hidden max-lg:inline">{qty(batch.ordersCount)} · </span>}
              {dateTime(batch.createdAt)}
            </div>
          </>
        ),
      },
    ];
    if (!isManager) {
      list.push({
        id: "from",
        header: t("columns.from"),
        sortable: true,
        cell: (batch) => (
          <>
            <div>{known(batch.fromBranch) ?? "—"}</div>
            <div className="hidden text-[13px] text-text-muted max-lg:block">{routeTo(batch)}</div>
          </>
        ),
      });
    }
    list.push(
      {
        id: "to",
        header: t("columns.to"),
        sortable: true,
        hideBelow: isManager ? undefined : "lg",
        cell: (batch) => known(batch.toBranch) ?? "—",
      },
      { id: "status", header: t("columns.status"), sortable: true, cell: statusBadge },
      {
        id: "orders",
        header: t("columns.orders"),
        sortable: true,
        align: "end",
        hideBelow: isManager ? undefined : "lg",
        cell: (batch) => qty(batch.ordersCount),
      },
      {
        id: "amount",
        header: t("columns.amount"),
        sortable: true,
        align: "end",
        cell: (batch) => <span className="font-semibold text-text">{money(batch.totalPrice)}</span>,
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
    );
    return list;
  }, [batchHref, dateTime, isManager, linkState, money, qty, routeTo, statusBadge, t]);

  // Telefon kartasi: «B-171 · summa», «Urgut filiali → Toshkent HQ», holat va «4 ta · Bugun, 15:20».
  const renderCard = useCallback(
    (batch: ReturnBatch) => {
      const from = known(batch.fromBranch);
      const to = known(batch.toBranch);
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
              <span className="whitespace-nowrap font-semibold">{money(batch.totalPrice)}</span>
            </span>
            {from || to ? (
              <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[13px] text-text-muted">
                {from}
                {from && to ? (
                  <ArrowRight aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-text-subtle" />
                ) : null}
                {to}
              </span>
            ) : null}
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {statusBadge(batch)}
              <span className="text-[13px] text-text-muted">
                {qty(batch.ordersCount)} · <span className="whitespace-nowrap">{dateTime(batch.createdAt)}</span>
              </span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-subtle" />
        </Link>
      );
    },
    [batchHref, dateTime, linkState, money, qty, statusBadge, t],
  );

  const total = data?.meta.total;
  const subject = isManager
    ? userBranchName
      ? t("descriptionBranch", { branch: userBranchName })
      : t("descriptionOwnBranch")
    : t("descriptionAll");
  const description = (
    <>
      {subject}
      {total !== undefined ? (
        <>
          {" · "}
          <span className="whitespace-nowrap">{t("total", { count: total, value: count(total) })}</span>
        </>
      ) : isLoading ? (
        <>
          {" · "}
          <Skeleton width={96} height={14} className="inline-block align-middle" />
        </>
      ) : null}
    </>
  );

  const handleSortChange = useCallback((next: DataTableSort | null) => {
    if (!next) return setSort(null);
    const key = SORT_KEYS.find((value) => value === next.key);
    setSort(key ? { key, direction: next.direction } : null);
  }, []);

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
        <div className="px-5 py-4 max-md:px-4">
          <div role="group" aria-label={t("filtersLabel")} className="flex max-w-[540px] flex-wrap items-center gap-3">
            <Field
              label={t("filters.status")}
              hideLabel
              labelAs="span"
              className="min-w-0 flex-[1_1_200px] max-md:basis-full"
            >
              <Select
                options={statusOptions}
                value={status || null}
                onChange={handleStatusChange}
                placeholder={t("filters.all")}
                inlineLabel={t("filters.status")}
                icon={CircleCheck}
              />
            </Field>
            <Field
              label={t("filters.date")}
              hideLabel
              labelAs="span"
              className="min-w-0 flex-[1_1_200px] max-md:basis-full"
            >
              <DateRange
                selection="day"
                presets={DATE_PRESETS}
                months={1}
                value={dateValue}
                onChange={handleDateChange}
                placeholder={t("filters.all")}
                inlineLabel={t("filters.date")}
              />
            </Field>
          </div>
        </div>

        <QueryBoundary
          query={{ data: rows, isLoading, isError, error, refetch }}
          loadingLabel={t("loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[t("columns.batch"), t("columns.from"), t("columns.status"), t("columns.amount")]}
              rows={6}
            />
          }
          empty={
            activeFilters ? (
              <EmptyState
                icon={SearchX}
                title={t(dateFilter ? "filteredEmptyPeriod" : "filteredEmpty")}
                description={t(dateFilter ? "filteredEmptyPeriodDescription" : "filteredEmptyDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {activeFilters > 1 ? t("filters.clearAll", { ns: "ui" }) : t("clearFilter")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Inbox} title={t("empty")} description={t("emptyDescription")} />
            )
          }
          error={(queryError, retry) => (
            <ErrorState error={queryError} title={t("messages.loadFailed")} onRetry={retry} />
          )}
          className="border-t border-border"
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(batch) => batch.id}
              label={t("listLabel")}
              cardsLabel={t("cardsLabel")}
              sort={sort}
              onSortChange={handleSortChange}
              onRowClick={(batch) => navigate(batchHref(batch), { state: linkState })}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default memo(ReturnsPage);
