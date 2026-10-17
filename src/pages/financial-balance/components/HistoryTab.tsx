// dizayn-v2: superadmin-balance-history, admin-balance-history
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronRight, SearchX, History as HistoryIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { cx } from "../../../shared/lib/cx";
import type { ISODateRange } from "../../../shared/lib/dateRange";
import { formatDateTimeLocalized, type DateInput } from "../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { scrollShellContentToTop, usePagination } from "../../../shared/lib/usePagination";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Pagination,
  QueryBoundary,
  Select,
  SkeletonTable,
  TONE_FG,
  type DataTableColumn,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { extractFinancialLedgerItems, extractFinancialLedgerPagination } from "../lib/financialBalance";
import {
  HISTORY_FROM_PARAM,
  HISTORY_LIMIT_PARAM,
  HISTORY_PAGE_PARAM,
  HISTORY_SOURCE_PARAM,
  HISTORY_TO_PARAM,
  LEDGER_SOURCE_TYPES,
  readHistoryFilters,
} from "../lib/historyFilters";
import { orderLink, toHistoryRow, toSourceTypeLabel, type HistoryRow } from "../lib/historyRow";
import FinancialHistoryDetail from "./FinancialHistoryDetail";

const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Ishorali summa rangi: kirim — `success-fg`, chiqim — `danger-fg` (ishora matnda ham bor). */
const changeClass = (value: number) => (value < 0 ? TONE_FG.danger : value > 0 ? TONE_FG.success : "text-text");

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const normalizePagination = (raw: Record<string, unknown> | undefined, fallbackPage: number, fallbackLimit: number) => {
  const total = toPositiveNumber(raw?.total ?? raw?.totalItems ?? raw?.itemCount ?? raw?.count) ?? 0;
  const page = toPositiveNumber(raw?.page ?? raw?.currentPage) ?? fallbackPage;
  const limit = toPositiveNumber(raw?.limit ?? raw?.perPage ?? raw?.pageSize) ?? fallbackLimit;
  return { total, page, limit };
};

/**
 * BALANS → TARIX (dizayn v2, maket `superadmin-balance-history`; admin — o'sha fragment).
 *
 * Filtrlar (`role=group` «Tarix filtrlari»): sana oralig'i + «Manba turi» — faqat URL'da
 * (`HISTORY_PARAM_PREFIX`), noto'g'ri sana/tur e'tiborsiz qoldiriladi, filtr o'zgarsa 1-sahifa (bitta
 * `setSearchParams` chaqiruvi). «Yozuvlar» kartasi: server sahifalashli jadval (telefonda kartalar),
 * qatorni bosish yoki «›» — `FinancialHistoryDetail`. «Daftar qoldig'i» grafigi maketda «Taklif» —
 * chizilmaydi. «Excelga yuklash» va «Yozuv qo'shish» — sahifa sarlavhasida (`index.tsx`).
 */
const HistoryTab = () => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const { useGetFinancialBalanceHistory } = useFinanceCoverage();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "payments",
    defaultLimit: 10,
    pageParam: HISTORY_PAGE_PARAM,
    limitParam: HISTORY_LIMIT_PARAM,
  });

  // Filtrlar faqat URL'da yashaydi (lokal nusxa yo'q) — F5 yoki havola filtrni ham, sahifani ham tiklaydi.
  const [searchParams, setSearchParams] = useSearchParams();
  const { fromDate, toDate, sourceType } = readHistoryFilters(searchParams);
  const activeFilters = (fromDate || toDate ? 1 : 0) + (sourceType ? 1 : 0);

  // Filtr va sahifa bitta setSearchParams chaqiruvida yangilanadi: ikkita alohida chaqiruv
  // bir-birining o'zgarishini bosib ketishi mumkin.
  const setFilters = useCallback(
    (patch: Record<string, string>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [param, value] of Object.entries(patch)) {
            if (value) next.set(param, value);
            else next.delete(param);
          }
          next.delete(HISTORY_PAGE_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleDateChange = useCallback(
    (range: ISODateRange) => setFilters({ [HISTORY_FROM_PARAM]: range.from, [HISTORY_TO_PARAM]: range.to }),
    [setFilters],
  );
  const handleSourceChange = useCallback(
    (value: string | null) => setFilters({ [HISTORY_SOURCE_PARAM]: value ?? "" }),
    [setFilters],
  );
  const clearFilters = useCallback(
    () => setFilters({ [HISTORY_FROM_PARAM]: "", [HISTORY_TO_PARAM]: "", [HISTORY_SOURCE_PARAM]: "" }),
    [setFilters],
  );

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };

    if (sourceType) params.source_type = sourceType;
    // C2 / CODE-22: oddiy `YYYY-MM-DD` — backend uni Toshkent kuni deb oladi
    // (UTC `T00:00:00.000Z` chegarasi 00:00–05:00 dagi yozuvni oldingi kunga tushirardi).
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;

    return params;
  }, [fromDate, limit, page, sourceType, toDate]);

  const historyQuery = useGetFinancialBalanceHistory(true, queryParams);
  const { data, isLoading, isError, error, refetch } = historyQuery;

  const rows = useMemo<HistoryRow[] | undefined>(
    () =>
      data === undefined || data === null
        ? undefined
        : (extractFinancialLedgerItems(data) as Record<string, unknown>[]).map(toHistoryRow),
    [data],
  );

  const pagination = useMemo(
    () => normalizePagination(extractFinancialLedgerPagination(data), page, limit),
    [data, limit, page],
  );

  // ─── Ko'rinish ─────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const number = useCallback(
    (value: number) => formatMoneyLocalized(value, { language, withCurrency: false }),
    [language],
  );
  const signed = useCallback((value: number) => formatSignedMoneyLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: unknown) => formatDateTimeLocalized(value as DateInput, { language }), [language]);
  const sourceLabel = useCallback((row: HistoryRow) => toSourceTypeLabel(row.sourceType, t), [t]);
  const openLabel = useCallback(
    (row: HistoryRow) => t("v2Balance.history.open", { source: sourceLabel(row), date: dateTime(row.date) }),
    [dateTime, sourceLabel, t],
  );

  const sourceOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("v2Balance.history.allSources") },
      ...LEDGER_SOURCE_TYPES.map((value) => ({ value, label: toSourceTypeLabel(value, t) })),
    ],
    [t],
  );

  const columns = useMemo<DataTableColumn<HistoryRow>[]>(
    () => [
      {
        id: "date",
        header: t("v2Balance.history.col.date"),
        className: "whitespace-nowrap",
        cell: (row) => dateTime(row.date),
      },
      {
        id: "source",
        header: t("v2Balance.history.col.source"),
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap font-semibold text-text">{sourceLabel(row)}</span>
            {row.orderId ? (
              <Link
                to={orderLink(row.orderId)}
                className="whitespace-nowrap text-[13px] font-semibold text-action-fg underline-offset-2 hover:underline"
              >
                {t("v2Balance.history.order", { id: row.orderId })}
              </Link>
            ) : !row.automatic ? (
              <span className="text-[13px] text-text-muted">{t("v2Balance.history.manual")}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "change",
        header: t("v2Balance.history.col.change"),
        align: "end",
        cell: (row) => <span className={cx("font-semibold", changeClass(row.changeAmount))}>{signed(row.changeAmount)}</span>,
      },
      {
        id: "balance",
        header: (
          <>
            {t("v2Balance.history.col.balance")}
            <span className="sr-only max-lg:hidden">{t("v2Balance.history.col.balanceSr")}</span>
          </>
        ),
        align: "end",
        cell: (row) => (
          <>
            <span className="max-lg:hidden">
              <span className="text-text-muted">{number(row.previousBalance)}</span>{" "}
              <ArrowRight aria-hidden="true" size={14} className="inline-block align-[-2px] text-text-subtle" />
              <span className="sr-only">{t("v2Balance.history.from")}</span>{" "}
            </span>
            <span className="font-semibold text-text">{money(row.nextBalance)}</span>
          </>
        ),
      },
      {
        id: "actor",
        header: t("v2Balance.history.col.actor"),
        hideBelow: "lg",
        cell: (row) =>
          row.automatic ? (
            <Badge>{t("v2Balance.history.automatic")}</Badge>
          ) : (
            <span className="whitespace-nowrap">{row.actorName || "—"}</span>
          ),
      },
      {
        id: "comment",
        header: t("v2Balance.history.col.comment"),
        hideBelow: "lg",
        cell: (row) =>
          row.comment ? (
            <span title={row.comment} className="block max-w-[170px] truncate">
              {row.comment}
            </span>
          ) : (
            <span className="text-text-subtle">—</span>
          ),
      },
      {
        id: "open",
        header: <span className="sr-only">{t("v2Balance.history.col.open")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (row) => (
          <IconButton
            size="sm"
            variant="ghost"
            icon={ChevronRight}
            label={openLabel(row)}
            onClick={() => setSelected(row)}
          />
        ),
      },
    ],
    [dateTime, money, number, openLabel, signed, sourceLabel, t],
  );

  // Telefon kartasi (maket `.el-list-item`): manba + o'zgarish; buyurtma/kiritgan · izoh; sana + qoldiq.
  const renderCard = useCallback(
    (row: HistoryRow) => {
      const who = row.automatic ? t("v2Balance.history.automatic") : row.actorName || "—";
      const meta = row.orderId
        ? `${t("v2Balance.history.order", { id: row.orderId })} · ${who}`
        : row.comment
          ? `${who} · ${row.comment}`
          : who;
      return (
        <button
          type="button"
          onClick={() => setSelected(row)}
          aria-label={openLabel(row)}
          className="flex w-full min-h-14 flex-col gap-1 px-4 py-3 text-left text-sm text-text"
        >
          <span className="flex w-full min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold">{sourceLabel(row)}</span>
            <span className={cx("whitespace-nowrap font-semibold", changeClass(row.changeAmount))}>
              {signed(row.changeAmount)}
            </span>
          </span>
          <span className="line-clamp-2 text-[13px] text-text-muted">{meta}</span>
          <span className="flex w-full flex-wrap justify-between gap-x-2 text-[13px] text-text-muted">
            <span className="whitespace-nowrap">{dateTime(row.date)}</span>
            <span className="whitespace-nowrap">{t("v2Balance.history.balanceLine", { value: money(row.nextBalance) })}</span>
          </span>
        </button>
      );
    },
    [dateTime, money, openLabel, signed, sourceLabel, t],
  );

  const total = pagination.total;
  const showTotal = rows !== undefined;
  // Sahifa / qatorlar soni almashganda tarix kartasining boshi ko'rinsin (D-03).
  const historyCardRef = useRef<HTMLElement>(null);
  const handlePageChange = (next: number) => {
    setPage(next);
    scrollShellContentToTop(historyCardRef.current);
  };
  const handlePageSizeChange = (next: number) => {
    setLimit(next);
    scrollShellContentToTop(historyCardRef.current);
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <div
        role="group"
        aria-label={t("v2Balance.history.filters")}
        className="flex max-w-[640px] flex-wrap items-center gap-3"
      >
        <Field
          label={t("v2Balance.history.date")}
          hideLabel
          labelAs="span"
          className="min-w-0 flex-[1_1_200px] max-md:basis-full"
        >
          <DateRange value={{ from: fromDate, to: toDate }} onChange={handleDateChange} />
        </Field>
        <Field
          label={t("v2Balance.history.source")}
          hideLabel
          labelAs="span"
          className="min-w-0 flex-[1_1_240px] max-md:basis-full"
        >
          <Select
            options={sourceOptions}
            value={sourceType || null}
            onChange={handleSourceChange}
            placeholder={t("v2Balance.history.allSources")}
            inlineLabel={t("v2Balance.history.source")}
          />
        </Field>
      </div>

      <Card
        ref={historyCardRef}
        padding="none"
        title={t("v2Balance.history.title")}
        description={t("v2Balance.history.subtitle")}
        actions={
          showTotal ? <Badge>{t("v2Balance.history.count", { value: formatNumberLocalized(total, { language }) })}</Badge> : null
        }
        footer={
          rows && total > 0 ? (
            <Pagination
              page={pagination.page}
              pageSize={pagination.limit}
              total={total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={PAGE_SIZES}
              summary={(range) => t("v2Balance.history.pagination", range)}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={{ data: rows, isLoading, isError, error, refetch }}
          loadingLabel={t("v2Balance.history.loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[
                t("v2Balance.history.col.date"),
                t("v2Balance.history.col.source"),
                t("v2Balance.history.col.change"),
                t("v2Balance.history.col.balance"),
              ]}
              rows={6}
            />
          }
          empty={
            activeFilters ? (
              <EmptyState
                icon={SearchX}
                title={t("v2Balance.history.filteredEmpty")}
                description={t("v2Balance.history.filteredEmptyDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t("v2Balance.history.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={HistoryIcon}
                title={t("v2Balance.history.empty")}
                description={t("v2Balance.history.emptyDescription")}
              />
            )
          }
          error={(queryError, retry) => <ErrorState error={queryError} onRetry={retry} />}
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(row, index) => row.id || String(index)}
              label={t("v2Balance.history.listLabel")}
              cardsLabel={t("v2Balance.history.cardsLabel")}
              onRowClick={(row) => setSelected(row)}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>

      <FinancialHistoryDetail row={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default memo(HistoryTab);
