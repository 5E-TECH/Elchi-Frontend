// dizayn-v2: (maket yo'q) superadmin-returns-list
import { memo, useCallback, useMemo } from "react";
import { CircleCheck, Repeat, SearchX, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import {
  OrderStatusBadge,
  REPLACEMENT_RETURN_STATES,
  formatReplacementOrderRef,
  useReplacementReturns,
  type ReplacementReturnRow,
} from "../../entities/order";
import { useMarkets } from "../../entities/markets";
import { formatDateLocalized, formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../shared/lib/formatMoney";
import { formatPhone } from "../../shared/lib/formatPhone";
import { usePagination } from "../../shared/lib/usePagination";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  buttonClasses,
  type DataTableColumn,
  type SelectOption,
} from "../../shared/ui/primitives";
import { toFilterOptions } from "../orders/list/useOrderFilterOptions";
import {
  REPLACEMENT_DEFAULT_LIMIT,
  REPLACEMENT_PAGE_SIZES,
  REPLACEMENT_STATE_META,
  buildReplacementReturnsParams,
  readReplacementFilters,
  replacementItemsText,
  replacementOrderHref,
  stateOrDefault,
  writeReplacementFilters,
  type ReplacementFilters,
} from "./model/replacementReturnsView";

const LINK = "whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline";

/**
 * ALMASHTIRISH QAYTARMALARI — `/replacement-returns` (lQjt6sKP, BeePost `replacement-returns`), dizayn v2.
 *
 * Kafolat bo'yicha almashtirishda yangi buyurtma avval yetkazilgan (eski) buyurtma o'rniga yuboriladi; kuryer yangisini
 * topshirib, eskisini mijozdan oladi. Bu sahifa — shu ESKI buyurtmalar: qaysi biri hali olinmagan («Kutilmoqda —
 * kuryer olishi kerak»), qaysi biri olingan («Olingan — marketga ketmoqda»).
 *
 * So'rov `GET orders/replacement/returns?state&market_id&page&limit` (`entities/order` → `useReplacementReturns`).
 * Superadmin va admin — hamma marketlar, «Market» filtri bilan (nomlar `GET /markets` ro'yxatidan — qatorda faqat
 * `market_id`); market — faqat o'zinikilar (backend tokendan), filtr yo'q. Filtrlar URL'da (`?state&market`).
 *
 * Ustunlar: eski buyurtma (havola; adminda market nomi), yangi buyurtma (havola + holati; o'chirilgan bo'lsa — izoh),
 * mijoz, mahsulot (summa bilan), almashtirish holati (olingan sanasi bilan), sotilgan sana. Telefonda — kartalar,
 * ikki havola tugma ko'rinishida (≥ 44 px). Faqat o'qish: backend'da «Marketga topshirildi» amali yo'q.
 *
 * Maket yo'q — eng yaqini `superadmin-returns-list` (sarlavha + jami, kartada filtrlar, jadval, sahifalash).
 */
const ReplacementReturnsPage = () => {
  const { t, i18n } = useTranslation("replacementReturns");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const canFilterMarket = role === "superadmin" || role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "replacementReturns",
    defaultLimit: REPLACEMENT_DEFAULT_LIMIT,
    allowedLimits: REPLACEMENT_PAGE_SIZES,
  });
  const filters = useMemo(() => readReplacementFilters(searchParams), [searchParams]);
  const marketFilter = canFilterMarket ? filters.market : "";
  const activeFilters = (filters.state ? 1 : 0) + (marketFilter ? 1 : 0);

  const params = useMemo(
    () => buildReplacementReturnsParams({ page, limit, filters, canFilterMarket }),
    [canFilterMarket, filters, limit, page],
  );
  const { data, isLoading, isPending, isFetching, isPaused, isError, error, refetch } = useReplacementReturns(params);

  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, canFilterMarket);
  const marketOptions = useMemo(() => toFilterOptions(marketsQuery.data), [marketsQuery.data]);
  const marketNames = useMemo(
    () => new Map(marketOptions.map((option) => [option.value, option.label])),
    [marketOptions],
  );

  const updateFilters = useCallback(
    (patch: Partial<ReplacementFilters>) =>
      setSearchParams((prev) => writeReplacementFilters(prev, patch), { replace: true }),
    [setSearchParams],
  );
  const clearFilters = useCallback(() => updateFilters({ state: "", market: "" }), [updateFilters]);

  const stateOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("filters.all") },
      ...REPLACEMENT_RETURN_STATES.map((value) => ({ value, label: t(`stateFilter.${value}`) })),
    ],
    [t],
  );
  const marketSelectOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: t("filters.allMarkets") }, ...marketOptions],
    [marketOptions, t],
  );

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const itemsOf = useCallback(
    (row: ReplacementReturnRow) =>
      replacementItemsText(row.items, (name, quantity) => t("itemLine", { name, qty: count(quantity) })),
    [count, t],
  );
  const marketOf = useCallback(
    (row: ReplacementReturnRow) =>
      row.market_id ? (marketNames.get(row.market_id) ?? t("marketFallback", { id: row.market_id })) : null,
    [marketNames, t],
  );
  const soldDate = useCallback(
    (row: ReplacementReturnRow) => (row.sold_at ? formatDateLocalized(row.sold_at, { language }) : "—"),
    [language],
  );
  const collectedLine = useCallback(
    (row: ReplacementReturnRow) =>
      row.old_item_collected_at
        ? t("collectedAt", { date: formatDateTimeLocalized(row.old_item_collected_at, { language }) })
        : null,
    [language, t],
  );

  const stateBadge = useCallback(
    (row: ReplacementReturnRow) => {
      const state = stateOrDefault(row.replacement_state);
      const meta = REPLACEMENT_STATE_META[state];
      return <StatusBadge tone={meta.tone} icon={meta.icon} label={t(`states.${state}`)} data-state={state} />;
    },
    [t],
  );

  const newOrderStatus = (row: ReplacementReturnRow) =>
    row.replacement_order_status ? <OrderStatusBadge status={row.replacement_order_status} /> : null;

  const columns: DataTableColumn<ReplacementReturnRow>[] = [
    {
      id: "oldOrder",
      header: t("columns.oldOrder"),
      cell: (row) => {
        const ref = formatReplacementOrderRef(row.id);
        const market = canFilterMarket ? marketOf(row) : null;
        return (
          <>
            <Link to={replacementOrderHref(row.id)} aria-label={t("openOld", { ref })} className={LINK}>
              {ref}
            </Link>
            {market ? <div className="text-[13px] text-text-muted">{market}</div> : null}
          </>
        );
      },
    },
    {
      id: "newOrder",
      header: t("columns.newOrder"),
      cell: (row) => {
        if (!row.replacement_order_id) {
          return <span className="text-[13px] text-text-muted">{t("newOrderDeleted")}</span>;
        }
        const ref = formatReplacementOrderRef(row.replacement_order_id);
        return (
          <span className="flex flex-col items-start gap-1">
            <Link to={replacementOrderHref(row.replacement_order_id)} aria-label={t("openNew", { ref })} className={LINK}>
              {ref}
            </Link>
            {newOrderStatus(row)}
          </span>
        );
      },
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text">{row.customer?.name ?? t("unknownCustomer")}</span>
          {row.customer?.phone_number ? (
            <span className="whitespace-nowrap text-[13px] text-text-muted tabular-nums">
              {formatPhone(row.customer.phone_number)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "products",
      header: t("columns.products"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text">{itemsOf(row) || "—"}</span>
          <span className="whitespace-nowrap text-[13px] text-text-muted">{money(row.total_price)}</span>
        </span>
      ),
    },
    {
      id: "state",
      header: t("columns.state"),
      cell: (row) => {
        const collected = collectedLine(row);
        return (
          <span className="flex flex-col items-start gap-1">
            {stateBadge(row)}
            {collected ? <span className="whitespace-nowrap text-[13px] text-text-muted">{collected}</span> : null}
          </span>
        );
      },
    },
    {
      id: "soldAt",
      header: t("columns.soldAt"),
      hideBelow: "lg",
      cellClassName: "whitespace-nowrap text-text-muted",
      cell: soldDate,
    },
  ];

  // Telefon kartasi: holat va summa, mahsulotlar, mijoz (adminda market), sana; ikki havola — eski va yangi buyurtma.
  const renderCard = (row: ReplacementReturnRow) => {
    const oldRef = formatReplacementOrderRef(row.id);
    const newRef = row.replacement_order_id ? formatReplacementOrderRef(row.replacement_order_id) : null;
    const who = [
      row.customer?.name ?? t("unknownCustomer"),
      row.customer?.phone_number ? formatPhone(row.customer.phone_number) : null,
      canFilterMarket ? marketOf(row) : null,
    ].filter(Boolean);
    return (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3 text-sm text-text">
        <span className="flex items-start justify-between gap-2">
          {stateBadge(row)}
          <span className="whitespace-nowrap font-semibold">{money(row.total_price)}</span>
        </span>
        <span>{itemsOf(row) || "—"}</span>
        <span className="text-[13px] text-text-muted">{who.join(" · ")}</span>
        <span className="text-[13px] text-text-muted">
          {collectedLine(row) ?? t("soldAt", { date: soldDate(row) })}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to={replacementOrderHref(row.id)}
            aria-label={t("openOld", { ref: oldRef })}
            className={buttonClasses({ variant: "secondary", size: "sm", compact: true })}
          >
            {t("oldRef", { ref: oldRef })}
          </Link>
          {row.replacement_order_id && newRef ? (
            <>
              <Link
                to={replacementOrderHref(row.replacement_order_id)}
                aria-label={t("openNew", { ref: newRef })}
                className={buttonClasses({ variant: "secondary", size: "sm", compact: true })}
              >
                {t("newRef", { ref: newRef })}
              </Link>
              {newOrderStatus(row)}
            </>
          ) : (
            <span className="text-[13px] text-text-muted">{t("newOrderDeleted")}</span>
          )}
        </span>
      </div>
    );
  };

  const total = data?.total;
  const description = (
    <>
      {role === "market" ? t("descriptionMarket") : t("description")}
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

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={description} />

      <Card
        as="section"
        padding="none"
        aria-label={t("listLabel")}
        footer={
          data && data.total > 0 ? (
            <Pagination
              page={data.page || page}
              pageSize={data.limit || limit}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              pageSizeOptions={REPLACEMENT_PAGE_SIZES}
              summary={(range) => t("pagination", range)}
            />
          ) : undefined
        }
      >
        <div className="px-5 py-4 max-md:px-4">
          <div role="group" aria-label={t("filtersLabel")} className="flex max-w-[540px] flex-wrap items-center gap-3">
            <Field label={t("filters.state")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_200px] max-md:basis-full">
              <Select
                options={stateOptions}
                value={filters.state || null}
                onChange={(value) => updateFilters({ state: (value ?? "") as ReplacementFilters["state"] })}
                placeholder={t("filters.all")}
                inlineLabel={t("filters.state")}
                icon={CircleCheck}
              />
            </Field>
            {canFilterMarket ? (
              <Field
                label={t("filters.market")}
                hideLabel
                labelAs="span"
                className="min-w-0 flex-[1_1_200px] max-md:basis-full"
              >
                <Select
                  searchable
                  options={marketSelectOptions}
                  value={filters.market || null}
                  onChange={(value) => updateFilters({ market: value ?? "" })}
                  placeholder={t("filters.allMarkets")}
                  inlineLabel={t("filters.market")}
                  icon={Store}
                  loading={marketsQuery.isLoading}
                />
              </Field>
            ) : null}
          </div>
        </div>

        <QueryBoundary
          query={{ data: data?.items, isLoading, isPending, isFetching, isPaused, isError, error, refetch }}
          isEmpty={(items) => items.length === 0}
          loadingLabel={t("loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[t("columns.oldOrder"), t("columns.newOrder"), t("columns.customer"), t("columns.state")]}
              rows={6}
            />
          }
          empty={
            activeFilters ? (
              <EmptyState
                icon={SearchX}
                title={t("filteredEmpty")}
                description={t(
                  filters.state === "old_returned" ? "returnedEmptyDescription" : "filteredEmptyDescription",
                )}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {activeFilters > 1 ? t("clearFilters") : t("clearFilter")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Repeat} title={t("empty")} description={t("emptyDescription")} />
            )
          }
          error={(queryError, retry) => <ErrorState error={queryError} title={t("loadFailed")} onRetry={retry} />}
          className="border-t border-border"
        >
          {(rows, { isRefetching }) => (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(row) => row.id}
              label={t("listLabel")}
              cardsLabel={t("cardsLabel")}
              density="tablet-tight"
              onRowClick={(row) => navigate(replacementOrderHref(row.id))}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default memo(ReplacementReturnsPage);
