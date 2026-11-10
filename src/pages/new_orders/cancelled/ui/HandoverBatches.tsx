import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, PackageCheck, SearchX, UserRound } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import {
  HANDOVER_BATCH_PAGE_LIMITS,
  type HandoverBatch,
  type HandoverBatchesPage,
} from "../../../../entities/orders/cancelledHandovers";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { scrollShellContentToTop } from "../../../../shared/lib/usePagination";
import {
  Button,
  DateRange,
  EmptyState,
  Pagination,
  QueryBoundary,
  Skeleton,
  TextInput,
  type QueryLike,
} from "../../../../shared/ui/primitives";
import {
  formatDayDots,
  formatTashkentTime,
  groupHandoverBatchesByDay,
  handoverMarketName,
  shiftDay,
  tashkentDayOf,
  type HandedFilters,
} from "../handedModel";
import { HandoverMethodBadges } from "./HandoverMethodBadges";

const STRONG = <strong className="font-semibold text-text" />;
const SEARCH_DEBOUNCE_MS = 350;

const CARD =
  "group flex h-full flex-col rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-xs " +
  "transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none hover:border-border-strong hover:shadow-sm";

type Props = {
  query: QueryLike<HandoverBatchesPage> & { isPlaceholderData?: boolean };
  filters: HandedFilters;
};

/**
 * «Bekor qilinganlar → Topshirilgan» (HQ): har «Marketga jo'natish» — bitta karta, kun bo'yicha guruhlangan (eng
 * yangisi tepada). Qidiruv (market nomi / telefoni) va sana oralig'i (sukut — joriy oy) serverda; xulosa — butun
 * filtr bo'yicha (`totals`). Karta → `/new-orders/cancelled/handovers/:batchId`.
 */
export const HandoverBatches = ({ query, filters }: Props) => {
  const { t, i18n } = useTranslation(["newOrders", "status"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);

  // Qidiruv: yozilayotganda har harfga so'rov ketmasin.
  const { search, setSearch } = filters;
  const [input, setInput] = useState(search);
  useEffect(() => {
    if (input.trim() === search) return;
    const id = window.setTimeout(() => setSearch(input), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input, search, setSearch]);

  const clearSearch = () => {
    setInput("");
    setSearch("");
  };

  const data = query.data;

  // URL'dagi sahifa oxirgisidan katta (eski havola, filtr torayib qolgan) — oxirgi sahifaga; shu orada «topshirish
  // yo'q» chizilmaydi (son > 0).
  const { page: currentPage, limit, setPage, setLimit } = filters;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  const outOfRange = Boolean(
    data && !query.isPlaceholderData && data.items.length === 0 && data.total > 0 && currentPage > lastPage,
  );
  useEffect(() => {
    if (outOfRange) setPage(lastPage);
  }, [lastPage, outOfRange, setPage]);

  // Sahifa / o'lcham almashganda ro'yxat boshiga (telefonda pastda qolib ketmasin — buyurtmalar D-03).
  const listRef = useRef<HTMLDivElement>(null);
  const changePage = useCallback(
    (next: number) => {
      setPage(next);
      scrollShellContentToTop(listRef.current);
    },
    [setPage],
  );
  const changeLimit = useCallback(
    (next: number) => {
      setLimit(next);
      scrollShellContentToTop(listRef.current);
    },
    [setLimit],
  );

  const today = tashkentDayOf(new Date());
  const dayTitle = useCallback(
    (day: string) => {
      const date = formatDayDots(day);
      if (day === today) return `${t("cancelled.handed.today")} · ${date}`;
      if (day === shiftDay(today, -1)) return `${t("cancelled.handed.yesterday")} · ${date}`;
      return date;
    },
    [t, today],
  );

  const summaryPart = (key: string, value: number) => (
    <span className="whitespace-nowrap">
      <Trans t={t} i18nKey={key} count={value} values={{ value: number(value) }} components={{ strong: STRONG }} />
    </span>
  );

  const summary: ReactNode =
    query.isLoading ? (
      <Skeleton width={260} height={14} />
    ) : data && data.items.length > 0 ? (
      <p className="text-[13px] leading-[18px] text-text-muted">
        {summaryPart("cancelled.handed.summaryBatches", data.totals.batches)}
        {" · "}
        {summaryPart("cancelled.handed.summaryOrders", data.totals.orders)}
        {" · "}
        <span className="whitespace-nowrap">
          <Trans
            t={t}
            i18nKey="cancelled.handed.summaryTotal"
            values={{ amount: money(data.totals.amount) }}
            components={{ strong: STRONG }}
          />
        </span>
      </p>
    ) : null;

  const empty = search ? (
    <EmptyState
      icon={SearchX}
      title={t("cancelled.handed.noMatchTitle")}
      description={t("cancelled.handed.noMatchDescription")}
      action={
        <Button variant="secondary" onClick={clearSearch}>
          {t("cancelled.handed.clearSearch")}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={PackageCheck}
      title={t("cancelled.handed.emptyTitle")}
      description={t("cancelled.handed.emptyDescription")}
    />
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
        <div className="flex min-w-0 flex-[1_1_480px] flex-wrap gap-2">
          <TextInput
            mode="search"
            value={input}
            onValueChange={setInput}
            placeholder={t("cancelled.handed.searchPlaceholder")}
            aria-label={t("cancelled.handed.searchLabel")}
            className="min-w-0 max-w-[400px] flex-[1_1_280px] max-md:max-w-none"
          />
          <DateRange
            value={filters.range}
            onChange={filters.setRange}
            clearable={false}
            aria-label={t("cancelled.handed.dateLabel")}
            className="w-full max-w-[260px] max-md:max-w-none"
            triggerClassName="whitespace-nowrap"
          />
        </div>
        {summary}
      </div>

      <QueryBoundary
        query={outOfRange ? { ...query, data: undefined, isLoading: true } : query}
        isEmpty={(page) => page.items.length === 0}
        skeleton="list"
        loadingLabel={t("cancelled.handed.loading")}
        empty={empty}
      >
        {(page, { isRefetching }) => (
          <div
            ref={listRef}
            className={cx(
              "flex flex-col gap-5 px-5 pb-5 max-md:px-4",
              (isRefetching || query.isPlaceholderData) && "opacity-60 transition-opacity",
            )}
            aria-busy={isRefetching || query.isPlaceholderData || undefined}
          >
            {groupHandoverBatchesByDay(page.items).map((group) => (
              <section key={group.day} aria-label={dayTitle(group.day)} className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-2">
                  <span className="text-sm font-bold text-text">{dayTitle(group.day)}</span>
                  <span className="text-xs text-text-muted">
                    {t("cancelled.handed.dayOrders", { count: group.orders, value: number(group.orders) })}
                  </span>
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                </h3>
                <ul role="list" aria-label={t("cancelled.handed.listLabel")} className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  {group.items.map((batch) => (
                    <li key={batch.id} className="min-w-0">
                      <BatchCard batch={batch} number={number} money={money} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {page.total > HANDOVER_BATCH_PAGE_LIMITS[0] ? (
              <Pagination
                page={currentPage}
                pageSize={limit}
                total={page.total}
                onPageChange={changePage}
                onPageSizeChange={changeLimit}
                pageSizeOptions={HANDOVER_BATCH_PAGE_LIMITS}
                summary={(range) => t("cancelled.handed.pagination", range)}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </>
  );
};

type BatchCardProps = {
  batch: HandoverBatch;
  number: (value: number) => string;
  money: (value: number) => string;
};

const BatchCard = ({ batch, number, money }: BatchCardProps) => {
  const { t } = useTranslation("newOrders");
  const location = useLocation();
  const name = handoverMarketName(batch, (id) => t("cancelled.handed.marketFallback", { id }));
  const phone = formatPhone(batch.market?.phone_number ?? "") || "—";
  const time = formatTashkentTime(batch.handed_at);
  return (
    <Link
      to={`/new-orders/cancelled/handovers/${encodeURIComponent(batch.id)}`}
      // Partiya sahifasidagi «← Topshirilgan» shu filtrlar (qidiruv, sana, sahifa) bilan qaytaradi.
      state={{ fromSearch: location.search }}
      className={CARD}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold text-text group-hover:text-action-fg">{name}</span>
          <span className="truncate text-[13px] text-text-muted">{phone}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-[13px] tabular-nums text-text-muted">{time}</span>
          <ChevronRight aria-hidden="true" className="size-[18px] text-text-subtle" />
        </span>
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-2 border-t border-border pt-2.5">
        <span className="text-sm font-semibold text-text">
          {t("cancelled.handed.orders", { count: batch.orders_count, value: number(batch.orders_count) })}
        </span>
        <span className="text-[15px] font-bold tabular-nums text-text">{money(batch.total_price_sum)}</span>
      </span>
      <span className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
        <HandoverMethodBadges batch={batch} />
        <span className="inline-flex min-w-0 items-center gap-1">
          <UserRound aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{batch.handed_by?.name || t("cancelled.handed.staffUnknown")}</span>
        </span>
      </span>
    </Link>
  );
};
