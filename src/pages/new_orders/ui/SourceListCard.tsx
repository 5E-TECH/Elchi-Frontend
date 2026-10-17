// dizayn-v2: superadmin-neworders-branches, admin-neworders-branches, superadmin-neworders-cancelled-markets, admin-neworders-cancelled, registrator-new-orders-cancelled
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import {
  filterTodayMarkets,
  sortTodayMarkets,
  sumTodayMarkets,
  type TodayMarketsTotals,
} from "../model/todayMarkets";
import NewOrdersTabs from "./NewOrdersTabs";

/**
 * «QABUL VA YARATISH» MANBA RO'YXATI KARTASI — «Marketlar» kartasining umumlashgani (dizayn v2).
 *
 * Tuzilma (maketlar `superadmin-neworders-branches`, `superadmin-neworders-cancelled-markets`):
 * `Card` (nomi `ariaLabel`) → qobiq tablari (`NewOrdersTabs`) → qidiruv + xulosa → `QueryBoundary` →
 * `DataTable` (telefonda kartalar). Ustunlar: nom (havola) · telefon · son · umumiy summa · «ochish» (›).
 *
 *  - Qidiruv, saralash va xulosa — mijoz tomonida (ro'yxat to'liq keladi, sahifalash yo'q). Qidiruv nom
 *    (katta-kichik harfsiz) va telefon raqamlari bo'yicha. Sukut saralash — son bo'yicha kamayish.
 *  - Xulosa faqat muvaffaqiyatli va bo'sh bo'lmagan ro'yxatda (xatoda yozilmaydi — noma'lum son «0» emas);
 *    yuklanishda skelet. Matnini sahifa beradi (`summary`), jami — barcha qatorlar (qidiruvdan qat'i nazar).
 *  - Qatorni bosish — `hrefOf(row)` ga o'tish (klaviatura uchun nom va › havolalari).
 */

/** Ro'yxat qatori: id (route uchun), nom, telefon, son (buyurtma/paket) va umumiy summa. */
export type SourceListRow = {
  id: string;
  name: string;
  phone_number: string;
  orders_count: number;
  total_price_sum: number;
};

/** `GET` so'rovining kartaga kerakli qismi (`useQuery` natijasi to'g'ridan-to'g'ri beriladi). */
export type SourceListQuery = {
  status: string;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => unknown;
};

export type SourceListCardProps<R extends SourceListRow> = {
  /** Barcha qatorlar (filtrsiz). */
  rows: readonly R[];
  query: SourceListQuery;
  /** Karta nomi (`aria-label`), masalan «Qabul kutayotgan buyurtmalar». */
  ariaLabel: string;
  searchPlaceholder: string;
  searchLabel: string;
  /** Jadval / kartalar ro'yxati nomi. */
  listLabel: string;
  /** Ekran o'quvchi uchun yuklanish matni. */
  loadingLabel: string;
  /** Ustun sarlavhalari. */
  columns: { name: string; phone: string; count: string; amount: string; actions: string };
  /** Saralash tugmalari maslahati. */
  sortTitles: { name: string; count: string; amount: string };
  /** «Son» katagi: «6 ta». */
  countCell: (count: number) => ReactNode;
  /** Telefon kartasining ikkinchi qatori: «+998 71 200 14 52 · 6 ta paket». */
  cardSub: (row: R) => ReactNode;
  /** «›» havolasining nomi: «Chilonzor qabul punkti paketlarini ochish». */
  openLabel: (row: R) => string;
  hrefOf: (row: R) => string;
  /** Qidiruv yonidagi xulosa (jami — barcha qatorlar bo'yicha). `null` — xulosa yo'q. */
  summary: (totals: TodayMarketsTotals) => ReactNode | null;
  /** Ro'yxat umuman bo'sh bo'lganda. */
  empty: ReactNode;
  /** Qidiruv natija bermaganda («Qidiruvni tozalash» tugmasi bilan). */
  noMatch: { title: string; description: string; clear: string };
};

/** Maketdagidek: soni ko'p qator tepada (`aria-sort="descending"`). */
const DEFAULT_SORT: DataTableSort = { key: "orders", direction: "desc" };

/**
 * Qatordagi «ochish» havolasi — `IconButton size="sm"` (ghost) ko'rinishida, lekin `<a>`: route'ga olib boradi
 * (yangi oynada ham ochiladi). Telefonda 44 px.
 */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-muted " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";

export const SourceListCard = <R extends SourceListRow>({
  rows: allRows,
  query,
  ariaLabel,
  searchPlaceholder,
  searchLabel,
  listLabel,
  loadingLabel,
  columns: labels,
  sortTitles,
  countCell,
  cardSub,
  openLabel,
  hrefOf,
  summary,
  empty,
  noMatch,
}: SourceListCardProps<R>) => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_SORT);

  const totals = useMemo(() => sumTodayMarkets(allRows), [allRows]);
  const rows = useMemo(
    () => sortTodayMarkets(filterTodayMarkets(allRows, search), sort, language),
    [allRows, language, search, sort],
  );
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);

  const columns = useMemo<DataTableColumn<R>[]>(
    () => [
      {
        id: "name",
        header: labels.name,
        sortable: true,
        sortTitle: sortTitles.name,
        className: "w-[30%]",
        cell: (row) => (
          <Link to={hrefOf(row)} className="font-semibold text-text hover:text-action-fg hover:underline">
            {row.name}
          </Link>
        ),
      },
      {
        id: "phone",
        header: labels.phone,
        className: "w-[22%] whitespace-nowrap",
        cell: (row) => formatPhone(row.phone_number) || "—",
      },
      {
        // Saralash kaliti `orders` — umumiy `sortTodayMarkets` qoidasi (`orders_count`).
        id: "orders",
        header: labels.count,
        align: "end",
        sortable: true,
        firstDirection: "desc",
        sortTitle: sortTitles.count,
        className: "w-[16%]",
        cell: (row) => countCell(row.orders_count),
      },
      {
        id: "amount",
        header: labels.amount,
        align: "end",
        sortable: true,
        firstDirection: "desc",
        sortTitle: sortTitles.amount,
        className: "w-[22%]",
        cell: (row) => <span className="font-semibold text-text">{money(row.total_price_sum)}</span>,
      },
      {
        id: "actions",
        header: <span className="sr-only">{labels.actions}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (row) => {
          const label = openLabel(row);
          return (
            <Link to={hrefOf(row)} aria-label={label} title={label} className={ICON_LINK}>
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
            </Link>
          );
        },
      },
    ],
    [countCell, hrefOf, labels, money, openLabel, sortTitles],
  );

  const renderCard = useCallback(
    (row: R) => (
      <Link to={hrefOf(row)} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold">{row.name}</span>
            <span className="whitespace-nowrap font-semibold">{money(row.total_price_sum)}</span>
          </span>
          <span className="text-[13px] text-text-muted">{cardSub(row)}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-subtle" />
      </Link>
    ),
    [cardSub, hrefOf, money],
  );

  const { isLoading, isError } = query;
  // Xulosa: yuklanishda skelet, xatoda yo'q, bo'sh ro'yxatda ham yo'q — bo'sh holat o'zi aytadi.
  const summaryNode =
    query.status === "success" && allRows.length > 0 ? summary(totals) : isLoading ? <Skeleton width={260} height={14} /> : null;

  const emptyNode =
    allRows.length === 0 ? (
      empty
    ) : (
      <EmptyState
        icon={SearchX}
        title={noMatch.title}
        description={noMatch.description}
        action={
          <Button variant="secondary" onClick={() => setSearch("")}>
            {noMatch.clear}
          </Button>
        }
      />
    );

  return (
    <Card padding="none" aria-label={ariaLabel}>
      <NewOrdersTabs />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
        <TextInput
          mode="search"
          value={search}
          onValueChange={setSearch}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="min-w-0 max-w-[480px] flex-[1_1_320px]"
        />
        {summaryNode}
      </div>

      <QueryBoundary
        query={{
          data: isLoading || (isError && allRows.length === 0) ? undefined : rows,
          isLoading,
          isError,
          error: query.error,
          refetch: query.refetch,
        }}
        keepPreviousData={false}
        loadingLabel={loadingLabel}
        loading={
          <SkeletonTable
            framed={false}
            columns={[labels.name, labels.phone, labels.count, labels.amount]}
            rows={6}
          />
        }
        empty={emptyNode}
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(row) => row.id}
            label={listLabel}
            sort={sort}
            onSortChange={setSort}
            onRowClick={(row) => navigate(hrefOf(row))}
            renderCard={renderCard}
            busy={isRefetching}
            className="max-md:border-t max-md:border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};
